"""Initialize public content and optionally provision the first administrator."""
import os

import bcrypt
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import User, seed_db


class Command(BaseCommand):
    help = 'Create missing public content; optionally create an admin from SADARA_ADMIN_* environment variables.'

    def handle(self, *args, **options):
        username = os.environ.get('SADARA_ADMIN_USERNAME', '').strip()
        password = os.environ.get('SADARA_ADMIN_PASSWORD', '')
        if bool(username) != bool(password):
            raise CommandError('Set both SADARA_ADMIN_USERNAME and SADARA_ADMIN_PASSWORD to create an administrator.')
        if password and not 12 <= len(password.encode()) <= 72:
            raise CommandError('Administrator password must contain between 12 and 72 UTF-8 bytes.')
        with transaction.atomic():
            seed_db()
            if username:
                _, created = User.objects.get_or_create(username=username, defaults={
                    'password_hash': bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
                    'full_name': os.environ.get('SADARA_ADMIN_NAME', 'مدير النظام'),
                    'role': 'superuser',
                })
                self.stdout.write('Administrator created.' if created else 'Existing administrator preserved.')
        self.stdout.write(self.style.SUCCESS('Public site content initialized; existing records preserved.'))
