from django.urls import path
from .views import (
    LoginView,
    LogoutView,
    SignupView,
    TimeLogListCreateView,
    TimeLogDetailView,
    TodayLogView,
    ActionView,
    BackdatedLogView,
    LeaveListCreateView,
    LeaveDetailView,
    HolidayListView,
    AdminUserListView,
    AdminUserDetailView,
    AdminStatsView,
    AdminExportCSVView,
    AdminUserLogsView,
    AdminHolidayView,
    AdminHolidayDetailView,
    AdminFetchHolidaysView,
    MonthlyStatsView,
    ProfileView,
    CorrectionRequestListCreateView,
    AdminCorrectionListView,
    AdminCorrectionDetailView,
    AdminEditUserLogView,
    AdminSettingsView,
)

urlpatterns = [
    # Auth
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/signup/", SignupView.as_view(), name="signup"),
    # Profile
    path("profile/", ProfileView.as_view(), name="profile"),
    # User logs
    path("logs/", TimeLogListCreateView.as_view(), name="log-list"),
    path("logs/<int:pk>/", TimeLogDetailView.as_view(), name="log-detail"),
    path("today/", TodayLogView.as_view(), name="today"),
    path("action/", ActionView.as_view(), name="action"),
    # Monthly
    path("monthly/", MonthlyStatsView.as_view(), name="monthly-stats"),
    # Leave
    path("leave/", LeaveListCreateView.as_view(), name="leave-list"),
    path("leave/<int:pk>/", LeaveDetailView.as_view(), name="leave-detail"),
    # Holidays (read for users)
    path("holidays/", HolidayListView.as_view(), name="holidays"),
    # Correction requests (user)
    path("corrections/", CorrectionRequestListCreateView.as_view(), name="corrections"),
    # Admin
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path(
        "admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"
    ),
    path(
        "admin/users/<int:pk>/logs/",
        AdminUserLogsView.as_view(),
        name="admin-user-logs",
    ),
    path("admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("admin/export/", AdminExportCSVView.as_view(), name="admin-export"),
    path("admin/holidays/", AdminHolidayView.as_view(), name="admin-holidays"),
    path(
        "admin/holidays/<int:pk>/",
        AdminHolidayDetailView.as_view(),
        name="admin-holiday-detail",
    ),
    path(
        "admin/holidays/fetch/",
        AdminFetchHolidaysView.as_view(),
        name="admin-holidays-fetch",
    ),
    path(
        "admin/corrections/",
        AdminCorrectionListView.as_view(),
        name="admin-corrections",
    ),
    path(
        "admin/corrections/<int:pk>/",
        AdminCorrectionDetailView.as_view(),
        name="admin-correction-detail",
    ),
    path("admin/logs/edit/", AdminEditUserLogView.as_view(), name="admin-edit-log"),
    path("admin/settings/", AdminSettingsView.as_view(), name="admin-settings"),
    path("today/", TodayLogView.as_view(), name="today"),
    path("action/", ActionView.as_view(), name="action"),
    path("backdated/", BackdatedLogView.as_view(), name="backdated-log"),
]
