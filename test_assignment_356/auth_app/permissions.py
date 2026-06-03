from rest_framework.response import Response
from rest_framework import status
from .models import UserRole, AccessRoleRule, BusinessElement


def require_auth(func):
    def wrapper(self, request, *args, **kwargs):
        if request.user_obj is None:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        return func(self, request, *args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper


def require_admin(func):
    def wrapper(self, request, *args, **kwargs):
        if request.user_obj is None:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        if not _is_admin(request.user_obj):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return func(self, request, *args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper


def _is_admin(user):
    return UserRole.objects.filter(user=user, role__name='admin').exists()


def check_permission(user, element_name: str, permission: str) -> bool:
    try:
        element = BusinessElement.objects.get(name=element_name)
    except BusinessElement.DoesNotExist:
        return False

    role_ids = UserRole.objects.filter(user=user).values_list('role_id', flat=True)
    return AccessRoleRule.objects.filter(
        role_id__in=role_ids,
        element=element,
        **{permission: True}
    ).exists()


def require_permission(element_name: str, permission: str):
    def decorator(func):
        def wrapper(self, request, *args, **kwargs):
            if request.user_obj is None:
                return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            if not check_permission(request.user_obj, element_name, permission):
                return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
            return func(self, request, *args, **kwargs)
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator
