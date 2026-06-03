import os
import sys
import django
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'test_assignment_356.settings')

from django.conf import settings

if not settings.configured:
    settings.configure(
        INSTALLED_APPS=[
            'django.contrib.contenttypes',
            'django.contrib.auth',
            'rest_framework',
            'test_assignment_356.auth_app',
        ],
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            }
        },
        ROOT_URLCONF='test_assignment_356.urls',
        MIDDLEWARE=[
            'django.middleware.common.CommonMiddleware',
            'test_assignment_356.auth_app.middleware.JWTAuthMiddleware',
        ],
        SECRET_KEY='test-secret',
        JWT_SECRET='test-jwt-secret',
        JWT_ALGORITHM='HS256',
        JWT_EXPIRY_HOURS=24,
        DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',
        REST_FRAMEWORK={
            'DEFAULT_AUTHENTICATION_CLASSES': [],
            'DEFAULT_PERMISSION_CLASSES': [],
            'EXCEPTION_HANDLER': 'test_assignment_356.auth_app.exceptions.custom_exception_handler',
        },
    )

django.setup()

from django.test.utils import setup_test_environment
setup_test_environment()


@pytest.fixture(autouse=True)
def reset_db():
    from django.test.utils import CaptureQueriesContext
    from django.db import connection
    from django.core.management import call_command

    call_command('migrate', '--run-syncdb', verbosity=0)

    from test_assignment_356.auth_app.models import (
        User, Role, UserRole, BusinessElement, AccessRoleRule, Session
    )
    Session.objects.all().delete()
    UserRole.objects.all().delete()
    AccessRoleRule.objects.all().delete()
    User.objects.all().delete()
    BusinessElement.objects.all().delete()
    Role.objects.all().delete()
    yield


@pytest.fixture
def api_client():
    from django.test import Client
    return Client()
