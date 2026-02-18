from django.urls import path
from . import views

urlpatterns = [
    path('', views.AuditLogListView.as_view(), name='auditlog-list'),
    path('<int:pk>/', views.AuditLogDetailView.as_view(), name='auditlog-detail'),
]
