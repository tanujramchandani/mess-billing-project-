from django.urls import path
from . import views

urlpatterns = [
    path('', views.PaymentListCreateView.as_view(), name='payment-list-create'),
    path('summary/', views.PaymentSummaryView.as_view(), name='payment-summary'),
    path('my/', views.MyPaymentsView.as_view(), name='my-payments'),
    path('my/summary/', views.StudentPaymentSummaryView.as_view(), name='student-payment-summary'),
    path('my/export/', views.ExportStudentPaymentsView.as_view(), name='student-payment-export'),
    path('submit/', views.SubmitPaymentView.as_view(), name='payment-submit'),
    path('<int:pk>/', views.PaymentDetailView.as_view(), name='payment-detail'),
    path('<int:pk>/verify/', views.VerifyPaymentView.as_view(), name='payment-verify'),
    path('<int:pk>/reject/', views.RejectPaymentView.as_view(), name='payment-reject'),
]
