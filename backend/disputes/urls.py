from django.urls import path
from . import views

urlpatterns = [
    path('', views.DisputeListCreateView.as_view(), name='dispute-list-create'),
    path('summary/', views.DisputeSummaryView.as_view(), name='dispute-summary'),
    path('<int:pk>/', views.DisputeDetailView.as_view(), name='dispute-detail'),
    path('create/', views.CreateDisputeView.as_view(), name='dispute-create'),
    path('<int:pk>/respond/', views.RespondToDisputeView.as_view(), name='dispute-respond'),
    path('<int:pk>/resolve/', views.ResolveDisputeView.as_view(), name='dispute-resolve'),
    path('<int:pk>/reject/', views.RejectDisputeView.as_view(), name='dispute-reject'),
    path('<int:pk>/reopen/', views.ReopenDisputeView.as_view(), name='dispute-reopen'),
    path('my/', views.MyDisputesView.as_view(), name='my-disputes'),
]
