from .models import User, Session
from .tokens import decode_token


class JWTAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.user_obj = None
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            payload = decode_token(token)
            if payload:
                try:
                    session = Session.objects.select_related('user').get(
                        token=token, is_active=True
                    )
                    if session.user.is_active:
                        request.user_obj = session.user
                except Session.DoesNotExist:
                    pass
        return self.get_response(request)
