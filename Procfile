web: cd backend && python manage.py migrate && python manage.py seed_site && gunicorn sadara_backend.wsgi:application --bind 0.0.0.0:$PORT
