from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination

from accounts.permissions import IsWardenOrAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class AuditLogListView(generics.ListAPIView):
    """
    List all audit log entries. Accessible by wardens and admins only.
    Supports filtering by user, action type, date range.
    """

    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsWardenOrAdmin]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = AuditLog.objects.select_related('user')

        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=int(user_id))

        # Filter by action type
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)

        # Filter by model name
        model_name = self.request.query_params.get('model_name')
        if model_name:
            queryset = queryset.filter(model_name__icontains=model_name)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(timestamp__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__date__lte=end_date)

        # Search across multiple fields
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search) |
                Q(model_name__icontains=search) |
                Q(action__icontains=search) |
                Q(description__icontains=search)
            )

        # Ordering
        ordering = self.request.query_params.get('ordering', '-timestamp')
        queryset = queryset.order_by(ordering)

        return queryset


class AuditLogDetailView(generics.RetrieveAPIView):
    """Retrieve a single audit log entry. Accessible by wardens and admins only."""

    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsWardenOrAdmin]

    def get_queryset(self):
        return AuditLog.objects.select_related('user')
