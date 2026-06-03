import datetime
import jwt
from django.conf import settings


def generate_token(user_id: int) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        'user_id': user_id,
        'exp': now + datetime.timedelta(hours=settings.JWT_EXPIRY_HOURS),
        'iat': now,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
