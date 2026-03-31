#!/bin/sh
# entrypoint.sh — Django admin container startup script
#
# Runs Django migrations and, when DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD
# are set, automatically creates a superuser on first start (idempotent — skipped if the
# user already exists).
#
# Required environment variables:
#   DATABASE_URL           – PostgreSQL connection string
#   SECRET_KEY             – Django secret key
#
# Optional environment variables (auto-superuser creation):
#   DJANGO_SUPERUSER_USERNAME  – admin username  (default: admin)
#   DJANGO_SUPERUSER_PASSWORD  – admin password  (required for auto-creation)
#   DJANGO_SUPERUSER_EMAIL     – admin email     (default: admin@localhost)

set -e

echo "==> Running Django migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

# Auto-create superuser when credentials are provided via environment variables.
# Uses a short Python snippet so the check-and-create is atomic and idempotent.
if [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
    SUPERUSER_USERNAME="${DJANGO_SUPERUSER_USERNAME:-admin}"
    SUPERUSER_EMAIL="${DJANGO_SUPERUSER_EMAIL:-admin@localhost}"

    echo "==> Ensuring superuser '${SUPERUSER_USERNAME}' exists..."
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='${SUPERUSER_USERNAME}').exists():
    User.objects.create_superuser(
        username='${SUPERUSER_USERNAME}',
        email='${SUPERUSER_EMAIL}',
        password='${DJANGO_SUPERUSER_PASSWORD}',
    )
    print('Superuser created: ${SUPERUSER_USERNAME}')
else:
    print('Superuser already exists: ${SUPERUSER_USERNAME}')
"
else
    echo "==> DJANGO_SUPERUSER_PASSWORD not set — skipping auto-superuser creation."
    echo "    To create a superuser manually, run:"
    echo "      bash scripts/create-superuser.sh"
    echo "    Or set DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD / DJANGO_SUPERUSER_EMAIL"
    echo "    in your .env file and restart the django-admin container."
fi

echo "==> Starting Gunicorn..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000
