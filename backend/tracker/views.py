from datetime import date, datetime
from calendar import monthrange
from django.contrib.auth.models import User
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
import requests
import csv

from .models import TimeLog, UserProfile, Holiday, Leave, CorrectionRequest, Settings
from .serializers import (
    TimeLogSerializer,
    UserSerializer,
    CreateUserSerializer,
    HolidaySerializer,
    LeaveSerializer,
    CorrectionRequestSerializer,
    SettingsSerializer,
)

# ── Helpers ───────────────────────────────────────────────────────


def _fmt(mins):
    if mins is None:
        return None
    sign = "+" if mins >= 0 else "-"
    h = int(abs(mins) // 60)
    m = int(abs(mins) % 60)
    return f"{sign}{h}h {m:02d}m"


def _get_holidays_for_year(year, gender):
    """Return set of holiday dates applicable to this user."""
    qs = Holiday.objects.filter(date__year=year)
    if gender != "F":
        qs = qs.filter(women_only=False)
    return {h.date for h in qs}


# ── Auth ──────────────────────────────────────────────────────────


class LoginView(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user_id": user.id,
                "username": user.username,
                "is_staff": user.is_staff,
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response({"detail": "Logged out."})


class SignupView(APIView):
    permission_classes = []

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "").strip()
        gender = request.data.get("gender", "M")

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(password) < 4:
            return Response(
                {"error": "Password must be at least 4 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST
            )
        if gender not in ("M", "F", "O"):
            gender = "M"

        user = User.objects.create_user(username=username, password=password)
        user.profile.gender = gender
        user.profile.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user_id": user.id,
                "username": user.username,
                "is_staff": user.is_staff,
            },
            status=status.HTTP_201_CREATED,
        )


# ── Profile ───────────────────────────────────────────────────────


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        profile = request.user.profile
        if "gender" in request.data:
            if request.data["gender"] in ("M", "F", "O"):
                profile.gender = request.data["gender"]
        if "required_hours" in request.data:
            profile.required_hours = request.data["required_hours"]
        profile.save()
        return Response(UserSerializer(request.user).data)


# ── User's own logs ───────────────────────────────────────────────


class TimeLogListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = TimeLog.objects.filter(user=request.user)
        return Response(TimeLogSerializer(logs, many=True).data)

    def post(self, request):
        serializer = TimeLogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user, date=date.today())
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TimeLogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return TimeLog.objects.get(pk=pk, user=user)
        except TimeLog.DoesNotExist:
            return None

    def get(self, request, pk):
        log = self.get_object(pk, request.user)
        if not log:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(TimeLogSerializer(log).data)

    def patch(self, request, pk):
        log = self.get_object(pk, request.user)
        if not log:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TimeLogSerializer(log, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        log = self.get_object(pk, request.user)
        if not log:
            return Response(status=status.HTTP_404_NOT_FOUND)
        log.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TodayLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        log, _ = TimeLog.objects.get_or_create(user=request.user, date=date.today())
        return Response(TimeLogSerializer(log).data)

    def patch(self, request):
        log, _ = TimeLog.objects.get_or_create(user=request.user, date=date.today())
        serializer = TimeLogSerializer(log, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BackdatedLogView(APIView):
    """Lets a user create/fill a log for a missed past day, within the current BS month."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from nepali_datetime import date as nepali_date

        log_date_str = request.data.get("date")
        note = request.data.get("note", "").strip()

        if not log_date_str:
            return Response(
                {"error": "date is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            log_date = datetime.strptime(log_date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = date.today()

        if log_date > today:
            return Response(
                {"error": "Cannot add a record for a future date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Confirm log_date falls within the current BS month
        today_bs = nepali_date.from_datetime_date(today)
        log_date_bs = nepali_date.from_datetime_date(log_date)

        if log_date_bs.year != today_bs.year or log_date_bs.month != today_bs.month:
            return Response(
                {"error": "You can only backdate entries within the current month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if log_date == today:
            return Response(
                {"error": "Use today's entry screen for today's record."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        log, created = TimeLog.objects.get_or_create(
            user=request.user,
            date=log_date,
            defaults={"is_backdated": True, "backdated_note": note},
        )

        if not created:
            # Already exists — treat this like filling in/updating a missed entry
            log.is_backdated = True
            if note:
                log.backdated_note = note

        serializer = TimeLogSerializer(log, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(TimeLogSerializer(log).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        action = request.data.get("action")
        time_str = request.data.get("time")

        valid_actions = ["sign_in", "lunch_start", "lunch_end", "sign_out"]
        if action not in valid_actions:
            return Response(
                {"error": f"Invalid action. Choose from {valid_actions}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if time_str:
            try:
                time_value = datetime.strptime(time_str, "%H:%M").time()
            except ValueError:
                return Response(
                    {"error": "Invalid time format. Use HH:MM"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            time_value = datetime.now().time().replace(second=0, microsecond=0)

        log, _ = TimeLog.objects.get_or_create(user=request.user, date=date.today())
        setattr(log, action, time_value)
        log.save()
        return Response(TimeLogSerializer(log).data)


# ── Leave ─────────────────────────────────────────────────────────


class LeaveListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        qs = Leave.objects.filter(user=request.user)
        if year:
            qs = qs.filter(date__year=year)
        if month:
            qs = qs.filter(date__month=month)
        return Response(LeaveSerializer(qs, many=True).data)

    def post(self, request):
        serializer = LeaveSerializer(data=request.data)
        if serializer.is_valid():
            # Check duplicate
            if Leave.objects.filter(
                user=request.user, date=serializer.validated_data["date"]
            ).exists():
                return Response(
                    {"error": "Leave already recorded for this date."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LeaveDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            leave = Leave.objects.get(pk=pk, user=request.user)
        except Leave.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        leave.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Holidays ──────────────────────────────────────────────────────


class HolidayListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.query_params.get("year", date.today().year)
        qs = Holiday.objects.filter(date__year=year)
        return Response(HolidaySerializer(qs, many=True).data)


class AdminHolidayView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        year = request.query_params.get("year", date.today().year)
        qs = Holiday.objects.filter(date__year=year)
        return Response(HolidaySerializer(qs, many=True).data)

    def post(self, request):
        serializer = HolidaySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(is_manual=True, source="manual")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminHolidayDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            holiday = Holiday.objects.get(pk=pk)
        except Holiday.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = HolidaySerializer(holiday, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            holiday = Holiday.objects.get(pk=pk)
        except Holiday.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        holiday.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminFetchHolidaysView(APIView):
    """Fetch holidays from Calendarific and store in DB."""

    permission_classes = [IsAdminUser]

    def post(self, request):
        from django.conf import settings

        year = request.data.get("year", date.today().year)
        api_key = getattr(settings, "CALENDARIFIC_API_KEY", None)

        if not api_key:
            return Response(
                {"error": "CALENDARIFIC_API_KEY not set in settings."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        url = "https://calendarific.com/api/v2/holidays"
        params = {
            "api_key": api_key,
            "country": "NP",
            "year": year,
            "type": "national",
        }

        try:
            res = requests.get(url, params=params, timeout=10)
            data = res.json()
        except Exception as e:
            return Response(
                {"error": f"Failed to fetch holidays: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        holidays = data.get("response", {}).get("holidays", [])
        created = 0
        skipped = 0

        # Women-only holiday keywords
        women_keywords = [
            "women",
            "teej",
            "haritalika",
            "nari",
            "mahila",
            "तीज",
            "हरितालिका",
            "नारी",
            "महिला",
        ]

        for h in holidays:
            h_date = date(
                h["date"]["datetime"]["year"],
                h["date"]["datetime"]["month"],
                h["date"]["datetime"]["day"],
            )
            name = h["name"]
            women_only = any(k in name.lower() for k in women_keywords)

            # Don't overwrite manual holidays on same date+name
            if Holiday.objects.filter(date=h_date, name=name, is_manual=True).exists():
                skipped += 1
                continue

            Holiday.objects.update_or_create(
                date=h_date,
                name=name,
                defaults={
                    "women_only": women_only,
                    "is_manual": False,
                    "source": "api",
                },
            )
            created += 1

        return Response(
            {
                "year": year,
                "created": created,
                "skipped": skipped,
                "total": len(holidays),
            }
        )


# ── Settings ──────────────────────────────────────────────────────


class AdminSettingsView(APIView):
    """Global org-wide settings, including default weekend days."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        settings_obj = Settings.get_solo()
        return Response(SettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = Settings.get_solo()
        serializer = SettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Monthly Stats ─────────────────────────────────────────────────


class MonthlyStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Accept either BS or AD year/month
        bs_year = request.query_params.get("bs_year")
        bs_month = request.query_params.get("bs_month")

        gender = request.user.profile.gender
        weekend_day_set = request.user.profile.get_weekend_days()

        # Convert BS month to AD date range if BS params provided
        if bs_year and bs_month:
            try:
                from nepali_datetime import date as nepali_date

                bs_year = int(bs_year)
                bs_month = int(bs_month)

                # Get first and last AD date of this BS month
                start_bs = nepali_date(bs_year, bs_month, 1)
                start_ad = start_bs.to_datetime_date()

                # Find last day of BS month
                if bs_month == 12:
                    next_month_start = nepali_date(bs_year + 1, 1, 1)
                else:
                    next_month_start = nepali_date(bs_year, bs_month + 1, 1)

                from datetime import timedelta

                end_ad = next_month_start.to_datetime_date() - timedelta(days=1)

            except Exception as e:
                return Response(
                    {"error": f"Invalid BS date: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # Fallback to AD year/month
            year = int(request.query_params.get("year", date.today().year))
            month = int(request.query_params.get("month", date.today().month))
            from nepali_datetime import date as nepali_date

            _, days_in_month = monthrange(year, month)
            start_ad = date(year, month, 1)
            end_ad = date(year, month, days_in_month)

            # Derive BS year/month from start of AD month
            start_bs = nepali_date.from_datetime_date(start_ad)
            bs_year = start_bs.year
            bs_month = start_bs.month

        # Build list of all AD dates in this BS month
        from datetime import timedelta

        all_days = []
        current = start_ad
        while current <= end_ad:
            all_days.append(current)
            current += timedelta(days=1)

        # Weekends: resolved per-user (override or global default)
        weekend_days = {d for d in all_days if d.weekday() in weekend_day_set}

        # Holidays for this user
        holiday_dates = _get_holidays_for_year(start_ad.year, gender)
        if start_ad.year != end_ad.year:
            holiday_dates |= _get_holidays_for_year(end_ad.year, gender)

        month_holiday_map = {}
        for d in all_days:
            if d in holiday_dates:
                qs = Holiday.objects.filter(date=d)
                if gender != "F":
                    qs = qs.filter(women_only=False)
                h = qs.first()
                if h:
                    month_holiday_map[d] = h

        non_working = weekend_days | set(month_holiday_map.keys())
        workdays = [d for d in all_days if d not in non_working]

        required_hours_per_day = float(request.user.profile.required_hours)
        total_required_minutes = len(workdays) * required_hours_per_day * 60

        # Logs and leaves
        logs = TimeLog.objects.filter(
            user=request.user,
            date__gte=start_ad,
            date__lte=end_ad,
        )
        leaves = Leave.objects.filter(
            user=request.user,
            date__gte=start_ad,
            date__lte=end_ad,
        )
        logs_by_date = {l.date: l for l in logs}
        leaves_by_date = {l.date: l for l in leaves}

        daily = []
        total_worked_minutes = 0
        total_diff_minutes = 0
        total_paid_leave_days = 0
        total_unpaid_leave_days = 0

        from nepali_datetime import date as nepali_date

        for d in all_days:
            is_weekend = d in weekend_days
            is_holiday = d in month_holiday_map
            holiday = month_holiday_map.get(d)
            log = logs_by_date.get(d)
            leave = leaves_by_date.get(d)

            worked = None
            diff = None
            required_mins = None
            day_status = "no_log"

            # Convert AD date to BS for display
            nd = nepali_date.from_datetime_date(d)
            bs_day = nd.day

            if is_weekend:
                day_status = "weekend"
            elif is_holiday:
                day_status = "holiday"
            elif leave:
                if leave.leave_type == "paid":
                    day_status = "paid_leave"
                    total_paid_leave_days += 1
                    worked = required_hours_per_day * 60
                    required_mins = required_hours_per_day * 60
                    diff = 0
                    total_worked_minutes += worked
                else:
                    day_status = "unpaid_leave"
                    total_unpaid_leave_days += 1
                    unpaid_mins = float(leave.hours) * 60
                    required_mins = required_hours_per_day * 60
                    worked = log.worked_minutes if log else 0
                    diff = (worked or 0) - (required_mins - unpaid_mins)
                    total_worked_minutes += worked or 0
                    total_diff_minutes += diff
            elif log:
                day_status = log.status
                required_mins = required_hours_per_day * 60
                worked = log.worked_minutes
                if worked is not None:
                    diff = worked - required_mins
                    total_worked_minutes += worked
                    total_diff_minutes += diff
            else:
                required_mins = required_hours_per_day * 60

            daily.append(
                {
                    "date": d.isoformat(),
                    "bs_day": bs_day,
                    "weekday": d.strftime("%a"),
                    "is_weekend": is_weekend,
                    "is_holiday": is_holiday,
                    "holiday_name": holiday.name if holiday else None,
                    "leave_type": leave.leave_type if leave else None,
                    "leave_hours": float(leave.hours) if leave else None,
                    "leave_note": leave.note if leave else None,
                    "leave_id": leave.id if leave else None,
                    "status": day_status,
                    "sign_in": (
                        log.sign_in.strftime("%H:%M") if log and log.sign_in else None
                    ),
                    "sign_out": (
                        log.sign_out.strftime("%H:%M") if log and log.sign_out else None
                    ),
                    "worked_minutes": worked,
                    "required_minutes": required_mins,
                    "difference_minutes": diff,
                    "difference_formatted": _fmt(diff),
                }
            )

        # BS month name
        bs_month_names_en = [
            "Baisakh",
            "Jestha",
            "Ashadh",
            "Shrawan",
            "Bhadra",
            "Ashwin",
            "Kartik",
            "Mangsir",
            "Poush",
            "Magh",
            "Falgun",
            "Chaitra",
        ]

        return Response(
            {
                "bs_year": bs_year,
                "bs_month": bs_month,
                "bs_month_name": bs_month_names_en[bs_month - 1],
                "ad_start": start_ad.isoformat(),
                "ad_end": end_ad.isoformat(),
                "total_workdays": len(workdays),
                "total_required_minutes": total_required_minutes,
                "total_worked_minutes": total_worked_minutes,
                "total_diff_minutes": total_diff_minutes,
                "total_diff_formatted": _fmt(total_diff_minutes),
                "total_paid_leave_days": total_paid_leave_days,
                "total_unpaid_leave_days": total_unpaid_leave_days,
                "daily": daily,
            }
        )


# ── Admin ─────────────────────────────────────────────────────────


class AdminUserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all().select_related("profile")
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        serializer = CreateUserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminUserDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def patch(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if "required_hours" in request.data:
            user.profile.required_hours = request.data["required_hours"]
            user.profile.save()
        if "is_active_profile" in request.data:
            user.profile.is_active = request.data["is_active_profile"]
            user.profile.save()
        if "gender" in request.data:
            user.profile.gender = request.data["gender"]
            user.profile.save()
        if "weekend_day_1" in request.data or "weekend_day_2" in request.data:
            d1 = request.data.get("weekend_day_1", None)
            d2 = request.data.get("weekend_day_2", None)
            # "Use global default" is signalled by sending both as null
            if d1 is None and d2 is None:
                user.profile.weekend_day_1 = None
                user.profile.weekend_day_2 = None
            elif d1 is not None and d2 is not None:
                if d1 == d2:
                    return Response(
                        {"error": "The two weekend days must be different."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.profile.weekend_day_1 = d1
                user.profile.weekend_day_2 = d2
            else:
                return Response(
                    {
                        "error": "Both weekend days must be set together, or both left empty to use the default."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.profile.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all().select_related("profile")
        result = []

        for user in users:
            logs = TimeLog.objects.filter(user=user)
            completed = [l for l in logs if l.status == "complete"]
            diffs = [
                l.difference_minutes
                for l in completed
                if l.difference_minutes is not None
            ]
            overtime = sum(d for d in diffs if d > 0)
            undertime = abs(sum(d for d in diffs if d < 0))
            avg_diff = sum(diffs) / len(diffs) if diffs else None

            result.append(
                {
                    "user_id": user.id,
                    "username": user.username,
                    "required_hours": float(user.profile.required_hours),
                    "is_active": user.profile.is_active,
                    "gender": user.profile.gender,
                    "total_logs": logs.count(),
                    "completed_days": len(completed),
                    "overtime_days": sum(1 for d in diffs if d > 0),
                    "undertime_days": sum(1 for d in diffs if d < 0),
                    "exact_days": sum(1 for d in diffs if d == 0),
                    "total_overtime": overtime,
                    "total_undertime": undertime,
                    "avg_difference": avg_diff,
                    "avg_diff_fmt": _fmt(avg_diff),
                    "recent_logs": TimeLogSerializer(logs[:7], many=True).data,
                }
            )

        return Response(result)


class AdminExportCSVView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        user_id = request.query_params.get("user_id")
        logs = TimeLog.objects.select_related("user").order_by("-date")
        if user_id:
            logs = logs.filter(user_id=user_id)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="timelogs.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "Username",
                "Date",
                "Sign In",
                "Lunch Start",
                "Lunch End",
                "Sign Out",
                "Worked (mins)",
                "Required (mins)",
                "Difference (mins)",
                "Status",
            ]
        )
        for log in logs:
            writer.writerow(
                [
                    log.user.username,
                    log.date,
                    log.sign_in or "",
                    log.lunch_start or "",
                    log.lunch_end or "",
                    log.sign_out or "",
                    log.worked_minutes or "",
                    log.required_minutes,
                    log.difference_minutes or "",
                    log.status,
                ]
            )
        return response


class AdminUserLogsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        logs = TimeLog.objects.filter(user=user)
        return Response(TimeLogSerializer(logs, many=True).data)


# ── Correction Requests ───────────────────────────────────────────


class CorrectionRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        requests = CorrectionRequest.objects.filter(user=request.user)
        return Response(CorrectionRequestSerializer(requests, many=True).data)

    def post(self, request):
        serializer = CorrectionRequestSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminCorrectionListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        filter_status = request.query_params.get("status", "pending")
        qs = CorrectionRequest.objects.select_related("user", "resolved_by")
        if filter_status != "all":
            qs = qs.filter(status=filter_status)
        return Response(CorrectionRequestSerializer(qs, many=True).data)


class AdminCorrectionDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            correction = CorrectionRequest.objects.get(pk=pk)
        except CorrectionRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")  # 'resolve' or 'reject'
        admin_note = request.data.get("admin_note", "")

        if action not in ("resolve", "reject"):
            return Response(
                {"error": "action must be resolve or reject"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone

        correction.status = "resolved" if action == "resolve" else "rejected"
        correction.resolved_at = timezone.now()
        correction.resolved_by = request.user
        correction.admin_note = admin_note
        correction.save()

        return Response(CorrectionRequestSerializer(correction).data)


class AdminEditUserLogView(APIView):
    """Admin can create or edit a log for any user on any date."""

    permission_classes = [IsAdminUser]

    def post(self, request):
        user_id = request.data.get("user_id")
        log_date = request.data.get("date")

        if not user_id or not log_date:
            return Response(
                {"error": "user_id and date are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # Parse date
        try:
            from datetime import datetime

            parsed_date = datetime.strptime(log_date, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        log, created = TimeLog.objects.get_or_create(
            user=user,
            date=parsed_date,
        )

        # Update only provided fields
        fields = ["sign_in", "lunch_start", "lunch_end", "sign_out"]
        for field in fields:
            if field in request.data:
                val = request.data[field]
                # Only update if a value was actually provided
                # Empty string means "leave unchanged", None means "clear the field"
                if val is None:
                    setattr(log, field, None)
                elif val != "":
                    try:
                        from datetime import datetime

                        setattr(log, field, datetime.strptime(val, "%H:%M").time())
                    except ValueError:
                        return Response(
                            {"error": f"Invalid time format for {field}. Use HH:MM."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                # if val == '' we skip it entirely — existing value is preserved
        log.save()

        return Response(
            {
                "created": created,
                "log": TimeLogSerializer(log).data,
            }
        )
