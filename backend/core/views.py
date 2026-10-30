"""Same-origin site delivery and validated JSON APIs used by both interfaces."""
import datetime
import hashlib
import json
import math
import mimetypes
import re
from functools import wraps
from pathlib import Path
from uuid import uuid4

import bcrypt
import jwt
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from core.models import Applicant, ContactMessage, Department, Lab, Setting, TuitionFee, User

BASE_DIR = Path(__file__).resolve().parent.parent
SADARA_DIR = BASE_DIR.parent / 'sadara'
DASHBORD_DIR = BASE_DIR.parent / 'dashbord'


class APIError(Exception):
    pass


def verify_token(request):
    header = request.headers.get('Authorization', '')
    scheme, _, token = header.partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        return None
    try:
        payload = jwt.decode(token.strip(), settings.JWT_SECRET, algorithms=['HS256'],
                             options={'require': ['exp', 'user_id']})
        return User.objects.filter(pk=payload['user_id']).first()
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError, ValidationError):
        return None


def api_view(methods, authenticated=()):
    """Keep API failures JSON and prevent private responses being cached."""
    def decorator(view):
        @csrf_exempt
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                response = JsonResponse({'message': 'طريقة الطلب غير مسموحة.'}, status=405)
                response['Allow'] = ', '.join(methods)
            elif request.method in authenticated and not verify_token(request):
                response = JsonResponse({'message': 'انتهت الجلسة أو يلزم تسجيل الدخول.'}, status=401)
            else:
                try:
                    response = view(request, *args, **kwargs)
                except APIError as exc:
                    response = JsonResponse({'message': str(exc)}, status=400)
                except ValidationError as exc:
                    response = JsonResponse({'message': 'يرجى التحقق من البيانات: ' + ' '.join(exc.messages)}, status=400)
                except IntegrityError:
                    response = JsonResponse({'message': 'تعذر الحفظ لوجود بيانات مكررة أو غير صالحة.'}, status=400)
            response['Cache-Control'] = 'no-store'
            return response
        return wrapped
    return decorator


def json_body(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise APIError('صيغة البيانات غير صالحة.')
    if not isinstance(data, dict):
        raise APIError('يجب إرسال البيانات ككائن JSON.')
    return data


def text_field(data, key, *, required=True, limit=10000):
    value = data.get(key, '')
    if not isinstance(value, str):
        raise APIError(f'قيمة الحقل {key} يجب أن تكون نصاً.')
    value = value.strip()
    if required and not value:
        raise APIError(f'الحقل {key} مطلوب.')
    if len(value) > limit:
        raise APIError(f'قيمة الحقل {key} أطول من الحد المسموح ({limit}).')
    return value


def save_validated(instance):
    instance.full_clean()
    with transaction.atomic():
        instance.save()
    return instance


def safe_file(root, filename):
    root = Path(root).resolve()
    path = (root / filename).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise Http404('File not found')
    return path


def serve_file(request, root, filename, *, asset=False):
    path = safe_file(root, filename)
    stat = path.stat()
    etag = '"' + hashlib.sha256(f'{stat.st_size}-{stat.st_mtime_ns}'.encode()).hexdigest() + '"'
    # Revalidate assets so updates to unversioned files reach existing visitors.
    cache = 'public, max-age=0, must-revalidate' if asset else 'no-cache'
    if etag in [value.strip() for value in request.headers.get('If-None-Match', '').split(',')]:
        response = HttpResponse(status=304)
    else:
        content_type = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
        response = FileResponse(path.open('rb'), content_type=content_type)
    response['ETag'] = etag
    response['Cache-Control'] = cache
    response['X-Content-Type-Options'] = 'nosniff'
    return response


def serve_root(request):
    return serve_file(request, SADARA_DIR, 'index.html')


def serve_dashbord_index(request):
    return serve_file(request, DASHBORD_DIR, 'index.html')


def serve_dashbord_assets(request, filename):
    return serve_file(request, DASHBORD_DIR, filename, asset=not filename.endswith('.html'))


def serve_site_assets(request, filename):
    return serve_file(request, SADARA_DIR / 'assets', filename, asset=True)


def serve_site_css(request, filename):
    return serve_file(request, SADARA_DIR / 'css', filename, asset=True)


def serve_site_js(request, filename):
    return serve_file(request, SADARA_DIR / 'js', filename, asset=True)


def serve_site_pages(request, page):
    return serve_file(request, SADARA_DIR, f'{page}.html')


def serve_media_files(request, filename):
    for root in (Path(settings.MEDIA_ROOT), Path(settings.MEDIA_ROOT) / 'media'):
        try:
            return serve_file(request, root, filename, asset=True)
        except Http404:
            pass
    raise Http404('Media file not found')


@api_view(('POST',))
def login(request):
    data = json_body(request)
    username = text_field(data, 'username', limit=255)
    password = data.get('password')
    if not isinstance(password, str) or not password or len(password) > 255:
        raise APIError('يرجى إدخال كلمة مرور صالحة.')
    # bcrypt rejects inputs over 72 bytes; invalid credentials must never become a 500.
    user = User.objects.filter(username=username).first()
    valid = False
    if user and len(password.encode()) <= 72:
        try:
            valid = bcrypt.checkpw(password.encode(), user.password_hash.encode())
        except (ValueError, TypeError):
            pass
    if not valid:
        return JsonResponse({'message': 'اسم المستخدم أو كلمة المرور غير صحيحة.'}, status=401)
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24),
    }, settings.JWT_SECRET, algorithm='HS256')
    return JsonResponse({'token': token, 'user': user_data(user)})


def user_data(user):
    return {'username': user.username, 'full_name': user.full_name, 'role': user.role}


@api_view(('GET',), authenticated=('GET',))
def get_me(request):
    return JsonResponse(user_data(verify_token(request)))


@api_view(('GET',))
def health(request):
    return JsonResponse({'status': 'ok'})


@api_view(('GET', 'POST'), authenticated=('POST',))
def handle_settings(request):
    if request.method == 'GET':
        return JsonResponse(dict(Setting.objects.values_list('key', 'value')))
    data = json_body(request)
    if not data:
        raise APIError('لا توجد بيانات للحفظ.')
    values = {}
    for key, value in data.items():
        if not re.fullmatch(r'[a-z][a-z0-9_]{0,254}', key):
            raise APIError('اسم أحد الإعدادات غير صالح.')
        if not isinstance(value, (str, int, float, bool)) or len(str(value)) > 20000:
            raise APIError('قيمة أحد الإعدادات غير صالحة.')
        values[key] = str(value)
    with transaction.atomic():
        for key, value in values.items():
            Setting.objects.update_or_create(key=key, defaults={'value': value})
    return JsonResponse({'message': 'تم تحديث الإعدادات بنجاح.'})


def applicant_data(item):
    return {**{key: getattr(item, key) for key in ('id', 'name', 'phone', 'gpa', 'stream', 'department', 'status')},
            'created_at': item.created_at.isoformat() if item.created_at else None}


@api_view(('GET', 'POST'), authenticated=('GET',))
def handle_applicants(request):
    if request.method == 'GET':
        return JsonResponse([applicant_data(item) for item in Applicant.objects.order_by('-id')], safe=False)
    data = json_body(request)
    name = text_field(data, 'name', limit=255)
    phone = text_field(data, 'phone', limit=50)
    stream = text_field(data, 'stream', limit=100)
    department = text_field(data, 'department', limit=100)
    if len(re.sub(r'\D', '', phone)) < 7 or not re.fullmatch(r'[+\d\s()\-]+', phone):
        raise APIError('يرجى إدخال رقم هاتف صحيح.')
    if stream not in ('scientific', 'literary'):
        raise APIError('يرجى اختيار نوع الثانوية.')
    try:
        if isinstance(data.get('gpa'), bool):
            raise ValueError
        gpa = float(data.get('gpa'))
    except (TypeError, ValueError, OverflowError):
        raise APIError('يرجى إدخال معدل صحيح من 0 إلى 100.')
    if not math.isfinite(gpa) or not 0 <= gpa <= 100:
        raise APIError('المعدل يجب أن يكون من 0 إلى 100.')
    item = save_validated(Applicant(name=name, phone=phone, gpa=gpa, stream=stream, department=department))
    return JsonResponse({'message': 'تم إرسال طلبك بنجاح.', 'id': item.id,
                         'pending_count': Applicant.objects.filter(status='pending').count()}, status=201)


@api_view(('PUT', 'DELETE'), authenticated=('PUT', 'DELETE'))
def handle_applicant_detail(request, applicant_id):
    try:
        item = Applicant.objects.get(pk=applicant_id)
    except Applicant.DoesNotExist:
        return JsonResponse({'message': 'الطلب غير موجود.'}, status=404)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'message': 'تم حذف الطلب.'})
    data = json_body(request)
    status = data.get('status')
    if status not in ('pending', 'approved', 'rejected'):
        raise APIError('حالة الطلب غير صالحة.')
    item.status = status
    item.save(update_fields=['status'])
    return JsonResponse({'message': 'تم تحديث حالة الطلب.', 'applicant': applicant_data(item)})


def content_fields(model):
    return [field.name for field in model._meta.fields if field.name != 'id']


def content_data(item):
    return {'id': item.id, **{key: getattr(item, key) for key in content_fields(type(item))}}


def validate_content(model, data):
    values = {}
    optional = ('description', 'careers', 'image_url', 'icon')
    for key in content_fields(model):
        if key not in data:
            raise APIError(f'الحقل {key} مطلوب.')
        if key in ('courses', 'specs'):
            value = data[key]
            if not isinstance(value, list) or len(value) > 100:
                raise APIError(f'الحقل {key} يجب أن يكون قائمة بحد أقصى 100 عنصر.')
            if key == 'courses':
                value = [{field: text_field(course, field, required=field == 'name', limit=500)
                          for field in ('code', 'name', 'type')} if isinstance(course, dict)
                         else None for course in value]
                if None in value:
                    raise APIError('بيانات المساقات غير صالحة.')
            elif any(not isinstance(spec, str) or not spec.strip() or len(spec) > 500 for spec in value):
                raise APIError('مواصفات المعمل يجب أن تكون نصوصاً غير فارغة.')
            values[key] = value
        else:
            field = model._meta.get_field(key)
            values[key] = text_field(data, key, required=key not in optional, limit=field.max_length or 20000)
    if 'category' in values and values['category'] not in ('medical', 'tech'):
        raise APIError('نوع القسم يجب أن يكون طبياً أو تقنياً.')
    if 'code' in values and not re.fullmatch(r'[a-zA-Z0-9_-]+', values['code']):
        raise APIError('رمز التخصص يجب أن يحتوي حروفاً إنجليزية وأرقاماً وشرطات فقط.')
    return values


def collection(request, model):
    if request.method == 'GET':
        return JsonResponse([content_data(item) for item in model.objects.order_by('id')], safe=False)
    values = validate_content(model, json_body(request))
    item = save_validated(model(**values))
    return JsonResponse({'message': 'تمت الإضافة بنجاح.', 'id': item.id}, status=201)


def detail(request, model, pk):
    try:
        item = model.objects.get(pk=pk)
    except model.DoesNotExist:
        return JsonResponse({'message': 'العنصر غير موجود.'}, status=404)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'message': 'تم الحذف بنجاح.'})
    for key, value in validate_content(model, json_body(request)).items():
        setattr(item, key, value)
    save_validated(item)
    return JsonResponse({'message': 'تم التحديث بنجاح.'})


@api_view(('GET', 'POST'), authenticated=('POST',))
def api_departments(request):
    return collection(request, Department)


@api_view(('PUT', 'DELETE'), authenticated=('PUT', 'DELETE'))
def api_department_detail(request, dept_id):
    return detail(request, Department, dept_id)


@api_view(('GET', 'POST'), authenticated=('POST',))
def api_labs(request):
    return collection(request, Lab)


@api_view(('PUT', 'DELETE'), authenticated=('PUT', 'DELETE'))
def api_lab_detail(request, lab_id):
    return detail(request, Lab, lab_id)


@api_view(('GET', 'POST'), authenticated=('POST',))
def api_fees(request):
    return collection(request, TuitionFee)


@api_view(('PUT', 'DELETE'), authenticated=('PUT', 'DELETE'))
def api_fee_detail(request, fee_id):
    return detail(request, TuitionFee, fee_id)


@api_view(('POST',), authenticated=('POST',))
def api_upload(request):
    uploaded = request.FILES.get('file')
    if not uploaded:
        raise APIError('يرجى اختيار صورة للرفع.')
    if uploaded.size > 5 * 1024 * 1024:
        raise APIError('حجم الصورة يجب ألا يتجاوز 5 ميجابايت.')
    header = uploaded.read(16)
    uploaded.seek(0)
    extension = Path(uploaded.name).suffix.lower()
    signatures = {
        '.png': header.startswith(b'\x89PNG\r\n\x1a\n'),
        '.jpg': header.startswith(b'\xff\xd8\xff'),
        '.jpeg': header.startswith(b'\xff\xd8\xff'),
        '.gif': header.startswith((b'GIF87a', b'GIF89a')),
        '.webp': header.startswith(b'RIFF') and header[8:12] == b'WEBP',
    }
    if not signatures.get(extension):
        raise APIError('يرجى رفع صورة PNG أو JPG أو GIF أو WebP صالحة.')
    saved_path = default_storage.save(f'{uuid4().hex}{extension}', uploaded)
    return JsonResponse({'message': 'تم رفع الصورة بنجاح.', 'url': default_storage.url(saved_path)})


def contact_data(item):
    return {**{key: getattr(item, key) for key in ('id', 'name', 'email', 'phone', 'subject', 'message', 'is_read')},
            'created_at': item.created_at.isoformat() if item.created_at else None}


@api_view(('GET', 'POST'), authenticated=('GET',))
def api_contact_messages(request):
    if request.method == 'GET':
        return JsonResponse([contact_data(item) for item in ContactMessage.objects.all()], safe=False)
    data = json_body(request)
    values = {key: text_field(data, key, required=key != 'phone', limit=limit)
              for key, limit in (('name', 255), ('email', 255), ('phone', 50), ('subject', 500), ('message', 10000))}
    item = save_validated(ContactMessage(**values))
    return JsonResponse({'message': 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.', 'id': item.id}, status=201)


@api_view(('PUT', 'DELETE'), authenticated=('PUT', 'DELETE'))
def api_contact_message_detail(request, msg_id):
    try:
        item = ContactMessage.objects.get(pk=msg_id)
    except ContactMessage.DoesNotExist:
        return JsonResponse({'message': 'الرسالة غير موجودة.'}, status=404)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'message': 'تم حذف الرسالة.'})
    data = json_body(request)
    if not isinstance(data.get('is_read'), bool):
        raise APIError('قيمة حالة القراءة يجب أن تكون true أو false.')
    item.is_read = data['is_read']
    item.save(update_fields=['is_read'])
    return JsonResponse({'message': 'تم تحديث الرسالة.'})
