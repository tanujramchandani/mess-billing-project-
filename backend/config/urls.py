from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from attendance import views as attendance_views

urlpatterns = [
    path('admin/', admin.site.urls),

    # API endpoints
    path('api/auth/', include('accounts.urls')),
    path('api/attendance/', include('attendance.urls')),

    # Mess rates as top-level endpoints (frontend expects /api/mess-rates/)
    path('api/mess-rates/', attendance_views.MessRateListCreateView.as_view(), name='messrate-list-create-api'),
    path('api/mess-rates/<int:pk>/', attendance_views.MessRateDetailView.as_view(), name='messrate-detail-api'),
    path('api/mess-rates/active/', attendance_views.ActiveMessRateView.as_view(), name='messrate-active-api'),

    path('api/bills/', include('billing.urls')),
    path('api/disputes/', include('disputes.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/analytics/', include('analytics.urls')),
    path('api/audit-logs/', include('audit_logs.urls')),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
