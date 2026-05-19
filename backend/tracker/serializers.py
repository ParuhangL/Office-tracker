from rest_framework import serializers
from django.contrib.auth.models import User
from .models import TimeLog, UserProfile, Holiday, Leave, CorrectionRequest

# ── User & Profile ────────────────────────────────────────────────


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("required_hours", "is_active", "gender")


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    required_hours = serializers.DecimalField(
        source="profile.required_hours", max_digits=4, decimal_places=1, read_only=True
    )
    is_active_profile = serializers.BooleanField(
        source="profile.is_active", read_only=True
    )
    gender = serializers.CharField(source="profile.gender", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "is_staff",
            "is_active",
            "is_active_profile",
            "profile",
            "required_hours",
            "gender",
        )


class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=4)
    required_hours = serializers.DecimalField(
        max_digits=4, decimal_places=1, default=8.0
    )
    is_staff = serializers.BooleanField(default=False)
    gender = serializers.ChoiceField(choices=["M", "F", "O"], default="M")

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            is_staff=validated_data.get("is_staff", False),
        )
        user.profile.required_hours = validated_data.get("required_hours", 8.0)
        user.profile.gender = validated_data.get("gender", "M")
        user.profile.save()
        return user


# ── Holiday ───────────────────────────────────────────────────────


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ("id", "date", "name", "women_only", "is_manual", "source")


# ── Leave ─────────────────────────────────────────────────────────


class LeaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Leave
        fields = ("id", "date", "leave_type", "hours", "note")

    def validate_hours(self, value):
        if value <= 0:
            raise serializers.ValidationError("Hours must be greater than 0.")
        return value


# ── TimeLog ───────────────────────────────────────────────────────


class TimeLogSerializer(serializers.ModelSerializer):
    worked_minutes = serializers.ReadOnlyField()
    required_minutes = serializers.ReadOnlyField()
    required_hours = serializers.ReadOnlyField()
    difference_minutes = serializers.ReadOnlyField()
    difference_formatted = serializers.ReadOnlyField()
    actual_lunch_minutes = serializers.ReadOnlyField()
    lunch_duration_minutes = serializers.ReadOnlyField()
    lunch_difference_minutes = serializers.ReadOnlyField()
    lunch_difference_formatted = serializers.ReadOnlyField()
    status = serializers.ReadOnlyField()

    class Meta:
        model = TimeLog
        fields = (
            "id",
            "date",
            "sign_in",
            "lunch_start",
            "lunch_end",
            "sign_out",
            "status",
            "worked_minutes",
            "required_minutes",
            "required_hours",
            "difference_minutes",
            "difference_formatted",
            "actual_lunch_minutes",
            "lunch_duration_minutes",
            "lunch_difference_minutes",
            "lunch_difference_formatted",
        )

    def validate(self, data):
        if data.get("lunch_end") and data.get("lunch_start"):
            if data["lunch_end"] <= data["lunch_start"]:
                raise serializers.ValidationError(
                    "Lunch end must be after lunch start."
                )
        if data.get("sign_out") and data.get("sign_in"):
            if data["sign_out"] <= data["sign_in"]:
                raise serializers.ValidationError("Sign out must be after sign in.")
        return data


# ── Correction Request ────────────────────────────────────────────


class CorrectionRequestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)  # ← add this
    resolved_by_username = serializers.CharField(
        source="resolved_by.username", read_only=True, default=None
    )

    class Meta:
        model = CorrectionRequest
        fields = (
            "id",
            "user_id",
            "username",
            "date",
            "note",
            "status",  # ← add user_id here
            "created_at",
            "resolved_at",
            "resolved_by_username",
            "admin_note",
        )
        read_only_fields = (
            "status",
            "created_at",
            "resolved_at",
            "resolved_by_username",
            "admin_note",
        )
