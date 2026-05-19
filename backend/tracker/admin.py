from django.contrib import admin
from django.utils.html import format_html
from .models import TimeLog


@admin.register(TimeLog)
class TimeLogAdmin(admin.ModelAdmin):

    # ── List view ──────────────────────────────────────────────────
    list_display = [
        "date",
        "sign_in",
        "lunch_start",
        "lunch_end",
        "sign_out",
        "colored_status",
        "worked_hours_display",
        "difference_display",
        "lunch_diff_display",
    ]

    list_filter = ["date"]
    search_fields = ["date"]
    ordering = ["-date"]
    date_hierarchy = "date"

    readonly_fields = [
        "worked_hours_display",
        "difference_display",
        "lunch_diff_display",
        "colored_status",
    ]

    # ── Detail / edit form layout ──────────────────────────────────
    fieldsets = (
        (
            "Date & Requirements",
            {
                "fields": (
                    "date",
                    "required_hours",
                    "lunch_duration_minutes",
                )
            },
        ),
        (
            "Time Entries",
            {
                "fields": (
                    "sign_in",
                    "lunch_start",
                    "lunch_end",
                    "sign_out",
                )
            },
        ),
        (
            "Calculated Summary",
            {
                "fields": (
                    "colored_status",
                    "worked_hours_display",
                    "difference_display",
                    "lunch_diff_display",
                )
            },
        ),
        (
            "Record Info",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    # ── Custom column: Status badge ────────────────────────────────
    @admin.display(description="Status")
    def colored_status(self, obj):
        colors = {
            "not_started": ("#6b7280", "Not Started"),
            "working": ("#2563eb", "Working"),
            "in_lunch": ("#d97706", "In Lunch"),
            "complete": ("#16a34a", "Complete"),
        }
        color, label = colors.get(obj.status, ("#6b7280", obj.status))
        return format_html(
            '<span style="'
            "background-color: {}; "
            "color: white; "
            "padding: 3px 10px; "
            "border-radius: 12px; "
            "font-size: 12px; "
            'font-weight: bold;">'
            "{}</span>",
            color,
            label,
        )

    # ── Custom column: Worked hours ────────────────────────────────
    @admin.display(description="Worked")
    def worked_hours_display(self, obj):
        mins = obj.worked_minutes
        if mins is None:
            return "—"
        hrs = int(mins // 60)
        mins = int(mins % 60)
        return f"{hrs}h {mins:02d}m"

    # ── Custom column: Over/Under time ─────────────────────────────
    @admin.display(description="Over / Under")
    def difference_display(self, obj):
        diff = obj.difference_minutes
        if diff is None:
            return "—"
        hrs = int(abs(diff) // 60)
        mins = int(abs(diff) % 60)
        if diff > 0:
            return format_html(
                '<span style="color: #16a34a; font-weight: bold;">+{}h {:02d}m</span>',
                hrs,
                mins,
            )
        elif diff < 0:
            return format_html(
                '<span style="color: #dc2626; font-weight: bold;">-{}h {:02d}m</span>',
                hrs,
                mins,
            )
        else:
            return format_html('<span style="color: #6b7280;">Exact</span>')

    # ── Custom column: Lunch over/under ───────────────────────────
    @admin.display(description="Lunch +/-")
    def lunch_diff_display(self, obj):
        diff = obj.lunch_difference_minutes
        if diff is None:
            return "—"
        mins = int(abs(diff))
        if diff > 0:
            return format_html('<span style="color: #d97706;">+{}m</span>', mins)
        elif diff < 0:
            return format_html('<span style="color: #2563eb;">-{}m</span>', mins)
        else:
            return format_html('<span style="color: #6b7280;">Exact</span>')
