import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
JWT_SECRET = os.environ.get('JWT_SECRET', 'jwt-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 24

DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'rest_framework',
    'test_assignment_356.auth_app',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'test_assignment_356.auth_app.middleware.JWTAuthMiddleware',
]

ROOT_URLCONF = 'test_assignment_356.urls'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [],
    'EXCEPTION_HANDLER': 'test_assignment_356.auth_app.exceptions.custom_exception_handler',
}
