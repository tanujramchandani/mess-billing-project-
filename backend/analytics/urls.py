from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.DashboardStatsView.as_view(), name='analytics-dashboard'),
    path('attendance-trends/', views.AttendanceTrendsView.as_view(), name='analytics-attendance-trends'),
    path('billing-summary/', views.BillingSummaryView.as_view(), name='analytics-billing-summary'),
    path('dispute-stats/', views.DisputeStatsView.as_view(), name='analytics-dispute-stats'),
    path('payment-stats/', views.PaymentStatsView.as_view(), name='analytics-payment-stats'),
    path('hostel-revenue/', views.HostelRevenueView.as_view(), name='analytics-hostel-revenue'),
    path('monthly-summary/', views.MonthlySummaryView.as_view(), name='analytics-monthly-summary'),
    # Student-specific analytics
    path('student/financial-summary/', views.StudentFinancialSummaryView.as_view(), name='student-financial-summary'),
    path('student/attendance-summary/', views.StudentAttendanceSummaryView.as_view(), name='student-attendance-summary'),
]
