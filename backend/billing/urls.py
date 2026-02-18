from django.urls import path
from . import views

urlpatterns = [
    # Bills
    path('', views.BillListView.as_view(), name='bill-list'),
    path('my/', views.MyBillsView.as_view(), name='my-bills'),
    path('my/summary/', views.StudentBillSummaryView.as_view(), name='student-bill-summary'),
    path('my/<int:pk>/', views.StudentBillDetailView.as_view(), name='student-bill-detail'),
    path('generate/', views.GenerateBillsView.as_view(), name='bill-generate'),
    path('preview/', views.BillPreviewView.as_view(), name='bill-preview'),
    path('summary/', views.BillSummaryView.as_view(), name='bill-summary'),
    path('export/', views.ExportBillsView.as_view(), name='bill-export'),
    path('<int:pk>/', views.BillDetailView.as_view(), name='bill-detail'),

    # Billing Cycles
    path('cycles/', views.BillingCycleListCreateView.as_view(), name='billing-cycle-list'),
    path('cycles/current/', views.CurrentBillingCycleView.as_view(), name='billing-cycle-current'),
    path('cycles/<int:pk>/', views.BillingCycleDetailView.as_view(), name='billing-cycle-detail'),
    path('cycles/<int:pk>/status/', views.BillingCycleStatusView.as_view(), name='billing-cycle-status'),
]
