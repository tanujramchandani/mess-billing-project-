from django.urls import path
from . import views

urlpatterns = [
    # Attendance endpoints
    path('', views.AttendanceListCreateView.as_view(), name='attendance-list-create'),
    path('<int:pk>/', views.AttendanceDetailView.as_view(), name='attendance-detail'),
    path('bulk/', views.BulkAttendanceView.as_view(), name='attendance-bulk'),
    path('summary/', views.AttendanceSummaryView.as_view(), name='attendance-summary'),
    path('student-detail/', views.StudentAttendanceDetailView.as_view(), name='student-attendance-detail'),
    path('my/', views.MyAttendanceView.as_view(), name='my-attendance'),
    # Mess rate endpoints
    path('mess-rates/', views.MessRateListCreateView.as_view(), name='messrate-list-create'),
    path('mess-rates/<int:pk>/', views.MessRateDetailView.as_view(), name='messrate-detail'),
    path('mess-rates/active/', views.ActiveMessRateView.as_view(), name='messrate-active'),
]
