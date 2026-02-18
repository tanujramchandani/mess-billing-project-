from rest_framework import permissions


class IsStudent(permissions.BasePermission):
    """Allow access only to users with the student role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'student'
        )


class IsContractor(permissions.BasePermission):
    """Allow access only to users with the contractor role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'contractor'
        )


class IsWarden(permissions.BasePermission):
    """Allow access only to users with the warden role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'warden'
        )


class IsContractorOrWarden(permissions.BasePermission):
    """Allow access to contractor or warden roles."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('contractor', 'warden')
        )


class IsWardenOrAdmin(permissions.BasePermission):
    """Allow access to warden role or Django admin users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (request.user.role == 'warden' or request.user.is_staff)
        )
