from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    required_hours = models.DecimalField(max_digits=4, decimal_places=1, default=8.0)
    is_active = models.BooleanField(default=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default="M")

    def __str__(self):
        return f"{self.user.username} — {self.required_hours}h"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()


class Holiday(models.Model):
    date = models.DateField()
    name = models.CharField(max_length=200)
    women_only = models.BooleanField(default=False)
    is_manual = models.BooleanField(
        default=False
    )  # admin-added, won't be overwritten by API
    source = models.CharField(max_length=50, default="api")  # 'api' or 'manual'

    class Meta:
        ordering = ["date"]
        unique_together = ("date", "name")

    def __str__(self):
        return f"{self.date} — {self.name}"


class Leave(models.Model):
    LEAVE_TYPES = [
        ("paid", "Paid Leave"),
        ("unpaid", "Unpaid Leave"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="leaves")
    date = models.DateField()
    leave_type = models.CharField(max_length=10, choices=LEAVE_TYPES)
    hours = models.DecimalField(max_digits=4, decimal_places=1, default=8.0)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date"]
        unique_together = ("user", "date")

    def __str__(self):
        return f"{self.user.username} — {self.date} ({self.leave_type})"


class TimeLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="timelogs")
    date = models.DateField()
    sign_in = models.TimeField(null=True, blank=True)
    lunch_start = models.TimeField(null=True, blank=True)
    lunch_end = models.TimeField(null=True, blank=True)
    sign_out = models.TimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "date")
        ordering = ["-date"]

    def __str__(self):
        return f"{self.user.username} — {self.date}"

    @property
    def required_hours(self):
        return float(self.user.profile.required_hours)

    @property
    def required_minutes(self):
        return self.required_hours * 60

    @property
    def lunch_duration_minutes(self):
        return 60

    @property
    def actual_lunch_minutes(self):
        if self.lunch_start and self.lunch_end:
            from datetime import datetime, date

            ls = datetime.combine(date.today(), self.lunch_start)
            le = datetime.combine(date.today(), self.lunch_end)
            return max((le - ls).total_seconds() / 60, 0)
        return None

    @property
    def lunch_difference_minutes(self):
        if self.actual_lunch_minutes is None:
            return None
        return self.lunch_duration_minutes - self.actual_lunch_minutes

    @property
    def lunch_difference_formatted(self):
        mins = self.lunch_difference_minutes
        if mins is None:
            return None
        sign = "+" if mins >= 0 else "-"
        h = int(abs(mins) // 60)
        m = int(abs(mins) % 60)
        return f"{sign}{h}h {m:02d}m"

    @property
    def worked_minutes(self):
        if self.sign_in and self.sign_out:
            from datetime import datetime, date

            si = datetime.combine(date.today(), self.sign_in)
            so = datetime.combine(date.today(), self.sign_out)
            total = (so - si).total_seconds() / 60
            lunch = self.actual_lunch_minutes or self.lunch_duration_minutes
            return max(total - lunch, 0)
        return None

    @property
    def difference_minutes(self):
        if self.worked_minutes is None:
            return None
        return self.worked_minutes - self.required_minutes

    @property
    def difference_formatted(self):
        mins = self.difference_minutes
        if mins is None:
            return None
        sign = "+" if mins >= 0 else "-"
        h = int(abs(mins) // 60)
        m = int(abs(mins) % 60)
        return f"{sign}{h}h {m:02d}m"

    @property
    def status(self):
        if not self.sign_in:
            return "not_started"
        if self.sign_out:
            return "complete"
        if self.lunch_start and not self.lunch_end:
            return "in_lunch"
        return "working"


class CorrectionRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("resolved", "Resolved"),
        ("rejected", "Rejected"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="correction_requests"
    )
    date = models.DateField()
    note = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_corrections",
    )
    admin_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} — {self.date} ({self.status})"
