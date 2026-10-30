"""Compatibility entry point backed by the same Django application as production.

Prefer ``python manage.py runserver 8000`` during development. Existing
``python app.py`` and ``gunicorn app:app`` commands continue to work without
starting a second, incomplete API implementation.
"""
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sadara_backend.settings')

from django.core.wsgi import get_wsgi_application

app = get_wsgi_application()

if __name__ == '__main__':
    from django.core.management import call_command

    call_command('migrate', interactive=False)
    call_command('seed_site')
    call_command('runserver', f"127.0.0.1:{os.environ.get('PORT', '5000')}")
