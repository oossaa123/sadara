import datetime
import importlib
import io
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import bcrypt
import jwt
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from core import views
from core.models import Applicant, ContactMessage, Department, Lab, Setting, TuitionFee, User


class APIIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create(username='test-admin', full_name='Test Admin',
            password_hash=bcrypt.hashpw(b'correct-test-password', bcrypt.gensalt(rounds=4)).decode())

    def setUp(self):
        self.client = Client()
        token = jwt.encode({'user_id': self.user.id,
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)},
            settings.JWT_SECRET, algorithm='HS256')
        self.auth = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        self.applicant = {'name': 'طالب تجريبي', 'phone': '+967 771 234 567', 'gpa': 87.5,
                          'stream': 'scientific', 'department': 'صيدلة'}
        self.contact = {'name': 'طالب تجريبي', 'email': 'student@example.com', 'phone': '',
                        'subject': 'استفسار عن القبول', 'message': 'ما هي متطلبات التسجيل؟'}
        self.department = {'name': 'تقنية المعلومات', 'code': 'it', 'category': 'tech',
                           'duration': '3 سنوات', 'description': '', 'icon': 'fa-laptop',
                           'image_url': '', 'careers': '',
                           'courses': [{'code': 'IT101', 'name': 'برمجة', 'type': 'عملي'}]}

    def post_json(self, path, payload, *, auth=False):
        return self.client.post(path, json.dumps(payload), content_type='application/json',
                                **(self.auth if auth else {}))

    def test_public_submission_then_admin_approval_and_delete(self):
        response = self.post_json('/api/applicants', self.applicant)
        self.assertEqual(response.status_code, 201)
        item = Applicant.objects.get(pk=response.json()['id'])
        self.assertEqual(item.status, 'pending')
        self.assertEqual(self.client.get('/api/applicants').status_code, 401)
        listing = self.client.get('/api/applicants', **self.auth)
        self.assertEqual(listing.json()[0]['name'], self.applicant['name'])
        self.assertEqual(listing['Cache-Control'], 'no-store')
        changed = self.client.put(f'/api/applicants/{item.id}', json.dumps({'status': 'approved'}),
                                  content_type='application/json', **self.auth)
        self.assertEqual(changed.json()['applicant']['status'], 'approved')
        self.assertEqual(self.client.delete(f'/api/applicants/{item.id}', **self.auth).status_code, 200)
        self.assertFalse(Applicant.objects.exists())

    def test_applicant_bad_values_never_write_rows(self):
        for field, value in [('name', ''), ('name', []), ('phone', 'abc'), ('stream', 'unknown'),
                             ('department', ' '), ('gpa', None), ('gpa', []), ('gpa', True),
                             ('gpa', -1), ('gpa', 101), ('gpa', 'NaN'), ('gpa', 'Infinity')]:
            with self.subTest(field=field, value=value):
                response = self.post_json('/api/applicants', {**self.applicant, field: value})
                self.assertEqual(response.status_code, 400)
                self.assertIn('message', response.json())
        self.assertEqual(Applicant.objects.count(), 0)

    def test_every_json_mutation_rejects_non_object_and_malformed_json(self):
        for path in ('/api/auth/login', '/api/applicants', '/api/contact', '/api/settings',
                     '/api/departments', '/api/labs', '/api/fees'):
            for payload in ([], None, True, 'value'):
                with self.subTest(path=path, payload=payload):
                    response = self.post_json(path, payload, auth=True)
                    self.assertEqual(response.status_code, 400)
            response = self.client.post(path, '{', content_type='application/json', **self.auth)
            self.assertEqual(response.status_code, 400)

    def test_login_and_me(self):
        response = self.post_json('/api/auth/login', {'username': self.user.username, 'password': 'correct-test-password'})
        self.assertEqual(response.status_code, 200)
        me = self.client.get('/api/auth/me', HTTP_AUTHORIZATION='Bearer ' + response.json()['token'])
        self.assertEqual(me.json()['username'], self.user.username)
        self.assertNotIn('password_hash', me.json())

    def test_healthcheck_is_public_and_uncached(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_bad_auth_and_oversized_password_do_not_raise(self):
        for password in ('wrong', 'x' * 100, 'ك' * 80):
            response = self.post_json('/api/auth/login', {'username': self.user.username, 'password': password})
            self.assertEqual(response.status_code, 401)
        for token in ('', 'Bearer', 'Bearer bad', 'Bearer  ', 'Basic x'):
            self.assertEqual(self.client.get('/api/auth/me', HTTP_AUTHORIZATION=token).status_code, 401)
        for payload in ({'user_id': self.user.id},
                        {'user_id': self.user.id, 'exp': 1},
                        {'user_id': [], 'exp': 9999999999}):
            token = jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')
            self.assertEqual(self.client.get('/api/auth/me', HTTP_AUTHORIZATION='Bearer ' + token).status_code, 401)

    def test_protected_mutations_require_authentication(self):
        for path in ('/api/settings', '/api/departments', '/api/labs', '/api/fees', '/api/upload'):
            self.assertEqual(self.post_json(path, {}).status_code, 401)
        for path in ('/api/departments/999', '/api/labs/999', '/api/fees/999',
                     '/api/applicants/999', '/api/contact/999'):
            self.assertEqual(self.client.delete(path).status_code, 401)

    def test_contact_flow_and_email_validation(self):
        response = self.post_json('/api/contact', self.contact)
        self.assertEqual(response.status_code, 201)
        pk = response.json()['id']
        self.assertEqual(self.client.get('/api/contact').status_code, 401)
        self.assertEqual(self.client.get('/api/contact', **self.auth).json()[0]['id'], pk)
        bad = self.post_json('/api/contact', {**self.contact, 'email': 'not-an-email'})
        self.assertEqual(bad.status_code, 400)
        bad_state = self.client.put(f'/api/contact/{pk}', json.dumps({'is_read': 'false'}),
                                   content_type='application/json', **self.auth)
        self.assertEqual(bad_state.status_code, 400)
        good = self.client.put(f'/api/contact/{pk}', json.dumps({'is_read': True}),
                              content_type='application/json', **self.auth)
        self.assertEqual(good.status_code, 200)
        self.assertTrue(ContactMessage.objects.get(pk=pk).is_read)
        self.assertEqual(self.client.delete(f'/api/contact/{pk}', **self.auth).status_code, 200)

    def test_settings_update_is_atomic_and_visible_to_public_site(self):
        response = self.post_json('/api/settings', {'hero_title': 'عنوان جديد', 'stat_students': '1200'}, auth=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/settings').json()['hero_title'], 'عنوان جديد')
        response = self.post_json('/api/settings', {'hero_title': 'لا يحفظ', 'bad key': 'bad'}, auth=True)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Setting.objects.get(pk='hero_title').value, 'عنوان جديد')

    def test_department_crud_unique_codes_and_list_validation(self):
        response = self.post_json('/api/departments', self.department, auth=True)
        self.assertEqual(response.status_code, 201)
        pk = response.json()['id']
        self.assertEqual(self.client.get('/api/departments').json()[0]['courses'][0]['code'], 'IT101')
        self.assertEqual(self.post_json('/api/departments', self.department, auth=True).status_code, 400)
        for change in ({'courses': {}}, {'courses': [1]}, {'courses': [{'name': ''}]}, {'category': 'other'}):
            response = self.post_json('/api/departments', {**self.department, 'code': 'new', **change}, auth=True)
            self.assertEqual(response.status_code, 400)
        response = self.client.put(f'/api/departments/{pk}', json.dumps({**self.department, 'name': 'اسم جديد'}),
                                   content_type='application/json', **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Department.objects.get(pk=pk).name, 'اسم جديد')
        self.assertEqual(self.client.delete(f'/api/departments/{pk}', **self.auth).status_code, 200)

    def test_labs_and_fees_contract(self):
        payloads = [('/api/labs', Lab, {'name': 'معمل', 'category': 'medical', 'image_url': '',
                                      'description': '', 'specs': ['أجهزة حديثة']}),
                    ('/api/fees', TuitionFee, {'department_name': 'صيدلة', 'official_fee': '$1000',
                         'discounted_fee': '$700', 'installment': '$350', 'payment_options': 'أقساط'})]
        for path, model, payload in payloads:
            response = self.post_json(path, payload, auth=True)
            self.assertEqual(response.status_code, 201)
            pk = response.json()['id']
            self.assertEqual(len(self.client.get(path).json()), 1)
            response = self.client.put(f'{path}/{pk}', json.dumps(payload), content_type='application/json', **self.auth)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(self.client.delete(f'{path}/{pk}', **self.auth).status_code, 200)
            self.assertEqual(model.objects.count(), 0)

    def test_upload_auth_size_and_image_types(self):
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            png = SimpleUploadedFile('image.png', b'\x89PNG\r\n\x1a\n' + b'\x00' * 16, content_type='image/png')
            response = self.client.post('/api/upload', {'file': png}, **self.auth)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()['url'].startswith('/media/'))
            self.assertEqual(len(list(Path(media).iterdir())), 1)
            for name, content in [('script.html', b'<script>alert(1)</script>'), ('fake.png', b'not a png'),
                                  ('vector.svg', b'<svg></svg>'), ('large.png', b'\x89PNG\r\n\x1a\n' + b'0' * (5 * 1024 * 1024))]:
                upload = SimpleUploadedFile(name, content)
                self.assertEqual(self.client.post('/api/upload', {'file': upload}, **self.auth).status_code, 400)

    def test_unsupported_methods_return_json_and_allow_header(self):
        response = self.client.get('/api/auth/login')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'], 'POST')
        self.assertIn('message', response.json())


class StaticServingTests(TestCase):
    def test_pages_and_assets_serve_correctly(self):
        for path, content_type in [('/', 'text/html'), ('/about.html', 'text/html'),
            ('/contact.html', 'text/html'), ('/admission.html', 'text/html'),
            ('/dashbord/', 'text/html'), ('/css/style.css', 'text/css'),
            ('/js/main.js', 'text/javascript')]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                if path.endswith('.js'):
                    self.assertIn(response['Content-Type'], ('text/javascript', 'application/javascript'))
                else:
                    self.assertTrue(response['Content-Type'].startswith(content_type))
                response.close()

    def test_etag_revalidation_and_missing_assets(self):
        response = self.client.get('/css/style.css')
        etag = response['ETag']
        response.close()
        cached = self.client.get('/css/style.css', HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(cached.status_code, 304)
        self.assertIn('must-revalidate', cached['Cache-Control'])
        for path in ('/dashbord/missing.css', '/missing.html', '/assets/absent.png'):
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_parent_sibling_and_symlink_escapes_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'assets'
            root.mkdir()
            sibling = Path(directory) / 'assets-private'
            sibling.mkdir()
            (sibling / 'private.txt').write_text('private')
            (root / 'outside.txt').symlink_to(sibling / 'private.txt')
            for name in ('../assets-private/private.txt', 'outside.txt'):
                with self.subTest(name=name), self.assertRaises(views.Http404):
                    views.safe_file(root, name)

    def test_urls_import_has_no_database_side_effects(self):
        import sadara_backend.urls
        with self.assertNumQueries(0):
            importlib.reload(sadara_backend.urls)

    def test_legacy_entry_point_uses_django_without_database_writes(self):
        with self.assertNumQueries(0):
            import app
        from django.core.handlers.wsgi import WSGIHandler
        self.assertIsInstance(app.app, WSGIHandler)


class InitializationTests(TestCase):
    def test_explicit_seed_preserves_existing_content_and_avoids_fake_records(self):
        Setting.objects.create(key='hero_title', value='Custom title')
        with patch.dict('os.environ', {'SADARA_ADMIN_USERNAME': '', 'SADARA_ADMIN_PASSWORD': ''}):
            call_command('seed_site', stdout=io.StringIO())
            call_command('seed_site', stdout=io.StringIO())
        self.assertEqual(Setting.objects.get(pk='hero_title').value, 'Custom title')
        self.assertEqual(Applicant.objects.count(), 0)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Department.objects.count(), 11)
        self.assertEqual(Setting.objects.get(pk='about_image').value, '/assets/images/hero.png')

    def test_admin_provisioning_is_explicit_and_does_not_reset_existing_user(self):
        with patch.dict('os.environ', {'SADARA_ADMIN_USERNAME': 'new-admin', 'SADARA_ADMIN_PASSWORD': 'secret-provision-password'}):
            call_command('seed_site', stdout=io.StringIO())
        user = User.objects.get(username='new-admin')
        original_hash = user.password_hash
        with patch.dict('os.environ', {'SADARA_ADMIN_USERNAME': 'new-admin', 'SADARA_ADMIN_PASSWORD': 'changed-provision-password'}):
            call_command('seed_site', stdout=io.StringIO())
        user.refresh_from_db()
        self.assertEqual(user.password_hash, original_hash)
        self.assertTrue(bcrypt.checkpw(b'secret-provision-password', user.password_hash.encode()))
