import os
import jwt
import json
import bcrypt
import datetime
import mimetypes
from functools import wraps
from pathlib import Path

from django.http import JsonResponse, FileResponse, Http404, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from core.models import Setting, Applicant, User, Department, Lab, TuitionFee, ContactMessage

JWT_SECRET = 'sadara_secret_key_2026_tech_innovation'

# Paths configuration
BASE_DIR = Path(__file__).resolve().parent.parent
SADARA_DIR = BASE_DIR.parent / 'sadara'
DASHBORD_DIR = BASE_DIR.parent / 'dashbord'

# ==========================================
# 1. JWT Authentication Decorator
# ==========================================
def token_required(f):
    @wraps(f)
    def decorated(request, *args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(" ")[1]
            
        if not token:
            return JsonResponse({'message': 'Missing authorization token.'}, status=401)
            
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            try:
                current_user = User.objects.get(id=data['user_id'])
            except User.DoesNotExist:
                return JsonResponse({'message': 'Invalid user token.'}, status=401)
        except jwt.ExpiredSignatureError:
            return JsonResponse({'message': 'Token has expired.'}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({'message': 'Invalid token.'}, status=401)
            
        return f(request, current_user, *args, **kwargs)
    return decorated

# Helper to verify token inline for views that handle multiple methods
def verify_token(request):
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(" ")[1]
    if not token:
        return None
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return User.objects.get(id=data['user_id'])
    except Exception:
        return None

# ==========================================
# 2. Static Files and Page Serving Views
# ==========================================
import hashlib

def _serve_file(file_path, content_type=None, cache_seconds=0):
    """Serve a file with proper caching headers (ETag + Cache-Control).
    Returns 304 Not Modified if file hasn't changed."""
    resolved = Path(os.path.abspath(file_path))
    if not resolved.exists() or not resolved.is_file():
        return None
    
    if content_type is None:
        content_type, _ = mimetypes.guess_type(str(resolved))
        content_type = content_type or 'application/octet-stream'
    
    # Build ETag from file size + modification time
    stat = resolved.stat()
    etag = hashlib.md5(f"{stat.st_size}-{stat.st_mtime}".encode()).hexdigest()
    etag_value = f'"{etag}"'
    
    response = FileResponse(open(resolved, 'rb'), content_type=content_type)
    response['ETag'] = etag_value
    
    if cache_seconds > 0:
        response['Cache-Control'] = f'public, max-age={cache_seconds}'
    else:
        response['Cache-Control'] = 'public, max-age=0, must-revalidate'
    
    return response

def _check_etag(request, file_path):
    """Check if browser already has the latest version (return True if so)."""
    resolved = Path(os.path.abspath(file_path))
    if not resolved.exists():
        return None
    stat = resolved.stat()
    etag = hashlib.md5(f"{stat.st_size}-{stat.st_mtime}".encode()).hexdigest()
    etag_value = f'"{etag}"'
    
    if_none_match = request.headers.get('If-None-Match', '')
    if if_none_match == etag_value:
        resp = HttpResponse(status=304)
        resp['ETag'] = etag_value
        return resp
    return None

def serve_root(request):
    index_path = SADARA_DIR / 'index.html'
    cached = _check_etag(request, index_path)
    if cached:
        return cached
    resp = _serve_file(index_path, 'text/html', cache_seconds=60)
    if resp:
        return resp
    raise Http404("Index file not found")

def serve_dashbord_index(request):
    index_path = DASHBORD_DIR / 'index.html'
    cached = _check_etag(request, index_path)
    if cached:
        return cached
    resp = _serve_file(index_path, 'text/html', cache_seconds=60)
    if resp:
        return resp
    raise Http404("Dashboard index file not found")

def serve_dashbord_assets(request, filename):
    file_path = DASHBORD_DIR / filename
    resolved_path = Path(os.path.abspath(file_path))
    resolved_dashbord = Path(os.path.abspath(DASHBORD_DIR))
    
    if not str(resolved_path).startswith(str(resolved_dashbord)):
        raise Http404("Access Denied")
    
    cached = _check_etag(request, resolved_path)
    if cached:
        return cached
    
    resp = _serve_file(resolved_path, cache_seconds=86400)
    if resp:
        return resp
        
    index_path = DASHBORD_DIR / 'index.html'
    if index_path.exists():
        return _serve_file(index_path, 'text/html', cache_seconds=60)
    raise Http404("File not found")

def serve_site_assets(request, filename):
    file_path = SADARA_DIR / 'assets' / filename
    resolved_path = Path(os.path.abspath(file_path))
    resolved_assets = Path(os.path.abspath(SADARA_DIR / 'assets'))
    
    if not str(resolved_path).startswith(str(resolved_assets)):
        raise Http404("Access Denied")
    
    cached = _check_etag(request, resolved_path)
    if cached:
        return cached
        
    resp = _serve_file(resolved_path, cache_seconds=86400)
    if resp:
        return resp
    raise Http404("Asset not found")

def serve_site_css(request, filename):
    file_path = SADARA_DIR / 'css' / filename
    resolved_path = Path(os.path.abspath(file_path))
    resolved_css = Path(os.path.abspath(SADARA_DIR / 'css'))
    
    if not str(resolved_path).startswith(str(resolved_css)):
        raise Http404("Access Denied")
    
    cached = _check_etag(request, resolved_path)
    if cached:
        return cached
        
    resp = _serve_file(resolved_path, cache_seconds=86400)
    if resp:
        return resp
    raise Http404("CSS file not found")

def serve_site_js(request, filename):
    file_path = SADARA_DIR / 'js' / filename
    resolved_path = Path(os.path.abspath(file_path))
    resolved_js = Path(os.path.abspath(SADARA_DIR / 'js'))
    
    if not str(resolved_path).startswith(str(resolved_js)):
        raise Http404("Access Denied")
    
    cached = _check_etag(request, resolved_path)
    if cached:
        return cached
        
    resp = _serve_file(resolved_path, cache_seconds=86400)
    if resp:
        return resp
    raise Http404("JS file not found")

def serve_site_pages(request, page):
    file_path = SADARA_DIR / f"{page}.html"
    resolved_path = Path(os.path.abspath(file_path))
    resolved_sadara = Path(os.path.abspath(SADARA_DIR))
    
    if not str(resolved_path).startswith(str(resolved_sadara)):
        raise Http404("Access Denied")
    
    cached = _check_etag(request, resolved_path)
    if cached:
        return cached
        
    resp = _serve_file(resolved_path, 'text/html', cache_seconds=60)
    if resp:
        return resp
        
    index_path = SADARA_DIR / 'index.html'
    if index_path.exists():
        return _serve_file(index_path, 'text/html', cache_seconds=60)
    raise Http404("Page not found")



# ==========================================
# 3. Authentication API Endpoints
# ==========================================
@csrf_exempt
def login(request):
    if request.method != 'POST':
        return JsonResponse({'message': 'Method not allowed.'}, status=405)
        
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'message': 'Invalid JSON.'}, status=400)
        
    if not data or 'username' not in data or 'password' not in data:
        return JsonResponse({'message': 'Username and password are required.'}, status=400)
        
    username = data['username']
    password = data['password']
    
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({'message': 'Invalid username or password.'}, status=401)
        
    if bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, JWT_SECRET, algorithm="HS256")
        
        return JsonResponse({
            'token': token,
            'user': {
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role
            }
        })
        
    return JsonResponse({'message': 'Invalid username or password.'}, status=401)

@csrf_exempt
@token_required
def get_me(request, current_user):
    if request.method != 'GET':
        return JsonResponse({'message': 'Method not allowed.'}, status=405)
        
    return JsonResponse({
        'username': current_user.username,
        'full_name': current_user.full_name,
        'role': current_user.role
    })


# ==========================================
# 4. Settings API Endpoints
# ==========================================
@csrf_exempt
def handle_settings(request):
    if request.method == 'GET':
        settings = Setting.objects.all()
        settings_dict = {s.key: s.value for s in settings}
        response = JsonResponse(settings_dict)
        # Prevent caching settings for API
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
        
    elif request.method == 'POST':
        user = verify_token(request)
        if not user:
            return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
            
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        if not data:
            return JsonResponse({'message': 'No data provided.'}, status=400)
            
        for key, value in data.items():
            Setting.objects.update_or_create(key=key, defaults={'value': str(value)})
            
        return JsonResponse({'message': 'Homepage settings updated successfully.'})
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)


# ==========================================
# 5. Applicants API Endpoints
# ==========================================
@csrf_exempt
def handle_applicants(request):
    if request.method == 'GET':
        user = verify_token(request)
        if not user:
            return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
            
        rows = Applicant.objects.all().order_by('-id')
        applicants_list = []
        for row in rows:
            applicants_list.append({
                'id': row.id,
                'name': row.name,
                'phone': row.phone,
                'gpa': row.gpa,
                'stream': row.stream,
                'department': row.department,
                'status': row.status,
                'created_at': row.created_at.isoformat() if row.created_at else None
            })
            
        response = JsonResponse(applicants_list, safe=False)
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
        
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        required = ['name', 'phone', 'gpa', 'stream', 'department']
        if not data or not all(k in data for k in required):
            return JsonResponse({'message': 'All applicant fields are required.'}, status=400)
            
        try:
            gpa_val = float(data['gpa'])
        except ValueError:
            return JsonResponse({'message': 'GPA must be a valid number.'}, status=400)
            
        Applicant.objects.create(
            name=data['name'],
            phone=data['phone'],
            gpa=gpa_val,
            stream=data['stream'],
            department=data['department'],
            status='pending'
        )
        
        pending = Applicant.objects.filter(status='pending').count()
        return JsonResponse({
            'message': 'Application submitted successfully.',
            'pending_count': pending
        }, status=201)
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def handle_applicant_detail(request, applicant_id):
    user = verify_token(request)
    if not user:
        return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
        
    try:
        applicant = Applicant.objects.get(id=applicant_id)
    except Applicant.DoesNotExist:
        return JsonResponse({'message': 'Applicant not found.'}, status=404)
        
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        if not data or 'status' not in data:
            return JsonResponse({'message': 'Status field is required.'}, status=400)
            
        status = data['status']
        if status not in ['pending', 'approved', 'rejected']:
            return JsonResponse({'message': 'Invalid status value.'}, status=400)
            
        applicant.status = status
        applicant.save()
        
        return JsonResponse({
            'message': f'Applicant status updated to {status}.',
            'applicant': {
                'id': applicant.id,
                'name': applicant.name,
                'phone': applicant.phone,
                'gpa': applicant.gpa,
                'stream': applicant.stream,
                'department': applicant.department,
                'status': applicant.status,
                'created_at': applicant.created_at.isoformat() if applicant.created_at else None
            }
        })
        
    elif request.method == 'DELETE':
        applicant.delete()
        return JsonResponse({'message': 'Applicant deleted successfully.'})
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def api_departments(request):
    if request.method == 'GET':
        depts = Department.objects.all().order_by('id')
        data = []
        for d in depts:
            data.append({
                'id': d.id,
                'name': d.name,
                'code': d.code,
                'category': d.category,
                'duration': d.duration,
                'description': d.description,
                'icon': d.icon,
                'image_url': d.image_url,
                'careers': d.careers,
                'courses': d.courses,
            })
        return JsonResponse(data, safe=False)
        
    elif request.method == 'POST':
        user = verify_token(request)
        if not user:
            return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
            
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        required = ['name', 'code', 'category', 'duration', 'description', 'icon', 'image_url', 'careers', 'courses']
        if not body or not all(k in body for k in required):
            return JsonResponse({'message': 'Missing required fields.'}, status=400)
            
        # check if code is unique
        if Department.objects.filter(code=body['code']).exists():
            return JsonResponse({'message': 'Department code already exists.'}, status=400)
            
        dept = Department.objects.create(
            name=body['name'],
            code=body['code'],
            category=body['category'],
            duration=body['duration'],
            description=body['description'],
            icon=body['icon'],
            image_url=body['image_url'],
            careers=body['careers'],
            courses=body['courses'],
        )
        return JsonResponse({
            'message': 'Department created successfully.',
            'id': dept.id
        }, status=201)
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def api_department_detail(request, dept_id):
    user = verify_token(request)
    if not user:
        return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
        
    try:
        dept = Department.objects.get(id=dept_id)
    except Department.DoesNotExist:
        return JsonResponse({'message': 'Department not found.'}, status=404)
        
    if request.method == 'PUT':
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        required = ['name', 'code', 'category', 'duration', 'description', 'icon', 'image_url', 'careers', 'courses']
        if not body or not all(k in body for k in required):
            return JsonResponse({'message': 'Missing required fields.'}, status=400)
            
        # check uniqueness of code if changed
        if body['code'] != dept.code and Department.objects.filter(code=body['code']).exists():
            return JsonResponse({'message': 'Department code already exists.'}, status=400)
            
        dept.name = body['name']
        dept.code = body['code']
        dept.category = body['category']
        dept.duration = body['duration']
        dept.description = body['description']
        dept.icon = body['icon']
        dept.image_url = body['image_url']
        dept.careers = body['careers']
        dept.courses = body['courses']
        dept.save()
        
        return JsonResponse({'message': 'Department updated successfully.'})
        
    elif request.method == 'DELETE':
        dept.delete()
        return JsonResponse({'message': 'Department deleted successfully.'})
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def api_upload(request):
    if request.method != 'POST':
        return JsonResponse({'message': 'Method not allowed.'}, status=405)
        
    user = verify_token(request)
    if not user:
        return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
        
    if 'file' not in request.FILES:
        return JsonResponse({'message': 'No file uploaded.'}, status=400)
        
    uploaded_file = request.FILES['file']
    from django.conf import settings
    
    # Ensure MEDIA_ROOT exists
    if not os.path.exists(settings.MEDIA_ROOT):
        os.makedirs(settings.MEDIA_ROOT)
        
    filename = uploaded_file.name
    actual_path = os.path.join(settings.MEDIA_ROOT, filename)
    if os.path.exists(actual_path):
        import time
        name, ext = os.path.splitext(filename)
        filename = f"{name}_{int(time.time())}{ext}"
        
    from django.core.files.storage import default_storage
    saved_path = default_storage.save(filename, uploaded_file)
    
    # Ensure URL starts with /media/
    file_url = settings.MEDIA_URL + saved_path.replace(os.sep, '/')
    if not file_url.startswith('/'):
        file_url = '/' + file_url
        
    return JsonResponse({
        'message': 'File uploaded successfully.',
        'url': file_url
    })

def serve_media_files(request, filename):
    from django.conf import settings
    
    # Check standard path: MEDIA_ROOT / filename
    file_path = Path(settings.MEDIA_ROOT) / filename
    resolved_path = Path(os.path.abspath(file_path))
    resolved_media = Path(os.path.abspath(settings.MEDIA_ROOT))
    
    # Check fallback path: MEDIA_ROOT / 'media' / filename (for old double-nested uploads)
    fallback_path = Path(settings.MEDIA_ROOT) / 'media' / filename
    resolved_fallback = Path(os.path.abspath(fallback_path))
    
    target_path = None
    if resolved_path.exists() and resolved_path.is_file():
        # Validate path traversal prevention
        if str(resolved_path).startswith(str(resolved_media)):
            target_path = resolved_path
    elif resolved_fallback.exists() and resolved_fallback.is_file():
        # Validate path traversal prevention for fallback path
        if str(resolved_fallback).startswith(str(resolved_media)):
            target_path = resolved_fallback
            
    if not target_path:
        raise Http404("Media file not found")
        
    cached = _check_etag(request, target_path)
    if cached:
        return cached
        
    resp = _serve_file(target_path, cache_seconds=86400)
    if resp:
        return resp
    raise Http404("Media file not found")

@csrf_exempt
def api_labs(request):
    if request.method == 'GET':
        labs = Lab.objects.all().order_by('id')
        data = []
        for l in labs:
            data.append({
                'id': l.id,
                'name': l.name,
                'category': l.category,
                'image_url': l.image_url,
                'description': l.description,
                'specs': l.specs
            })
        return JsonResponse(data, safe=False)
        
    elif request.method == 'POST':
        user = verify_token(request)
        if not user:
            return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
            
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        required = ['name', 'category', 'image_url', 'description', 'specs']
        if not body or not all(k in body for k in required):
            return JsonResponse({'message': 'Missing required fields.'}, status=400)
            
        lab = Lab.objects.create(
            name=body['name'],
            category=body['category'],
            image_url=body['image_url'],
            description=body['description'],
            specs=body['specs']
        )
        return JsonResponse({
            'message': 'Lab created successfully.',
            'id': lab.id
        }, status=201)
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def api_lab_detail(request, lab_id):
    user = verify_token(request)
    if not user:
        return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
        
    try:
        lab = Lab.objects.get(id=lab_id)
    except Lab.DoesNotExist:
        return JsonResponse({'message': 'Lab not found.'}, status=404)
        
    if request.method == 'PUT':
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        required = ['name', 'category', 'image_url', 'description', 'specs']
        if not body or not all(k in body for k in required):
            return JsonResponse({'message': 'Missing required fields.'}, status=400)
            
        lab.name = body['name']
        lab.category = body['category']
        lab.image_url = body['image_url']
        lab.description = body['description']
        lab.specs = body['specs']
        lab.save()
        
        return JsonResponse({'message': 'Lab updated successfully.'})
        
    elif request.method == 'DELETE':
        lab.delete()
        return JsonResponse({'message': 'Lab deleted successfully.'})
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def api_fees(request):
    if request.method == 'GET':
        fees = TuitionFee.objects.all().order_by('id')
        data = []
        for f in fees:
            data.append({
                'id': f.id,
                'department_name': f.department_name,
                'official_fee': f.official_fee,
                'discounted_fee': f.discounted_fee,
                'installment': f.installment,
                'payment_options': f.payment_options
            })
        return JsonResponse(data, safe=False)
        
    elif request.method == 'POST':
        user = verify_token(request)
        if not user:
            return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
            
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        required = ['department_name', 'official_fee', 'discounted_fee', 'installment', 'payment_options']
        if not body or not all(k in body for k in required):
            return JsonResponse({'message': 'Missing required fields.'}, status=400)
            
        fee = TuitionFee.objects.create(
            department_name=body['department_name'],
            official_fee=body['official_fee'],
            discounted_fee=body['discounted_fee'],
            installment=body['installment'],
            payment_options=body['payment_options']
        )
        return JsonResponse({
            'message': 'Tuition fee created successfully.',
            'id': fee.id
        }, status=201)
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def api_fee_detail(request, fee_id):
    user = verify_token(request)
    if not user:
        return JsonResponse({'message': 'Invalid, missing or expired authorization token.'}, status=401)
        
    try:
        fee = TuitionFee.objects.get(id=fee_id)
    except TuitionFee.DoesNotExist:
        return JsonResponse({'message': 'Tuition fee not found.'}, status=404)
        
    if request.method == 'PUT':
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
            
        required = ['department_name', 'official_fee', 'discounted_fee', 'installment', 'payment_options']
        if not body or not all(k in body for k in required):
            return JsonResponse({'message': 'Missing required fields.'}, status=400)
            
        fee.department_name = body['department_name']
        fee.official_fee = body['official_fee']
        fee.discounted_fee = body['discounted_fee']
        fee.installment = body['installment']
        fee.payment_options = body['payment_options']
        fee.save()
        
        return JsonResponse({'message': 'Tuition fee updated successfully.'})
        
    elif request.method == 'DELETE':
        fee.delete()
        return JsonResponse({'message': 'Tuition fee deleted successfully.'})
        
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)


# ==========================================
# 9. Contact Messages API Endpoints
# ==========================================
@csrf_exempt
def api_contact_messages(request):
    if request.method == 'GET':
        user = verify_token(request)
        if not user:
            return JsonResponse({'message': 'Unauthorized'}, status=401)
        
        messages = ContactMessage.objects.all()
        data = []
        for msg in messages:
            data.append({
                'id': msg.id,
                'name': msg.name,
                'email': msg.email,
                'phone': msg.phone,
                'subject': msg.subject,
                'message': msg.message,
                'is_read': msg.is_read,
                'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M') if msg.created_at else ''
            })
        return JsonResponse(data, safe=False)
    
    elif request.method == 'POST':
        # Public - anyone can submit a contact message
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
        
        required = ['name', 'email', 'subject', 'message']
        for field in required:
            if not data.get(field):
                return JsonResponse({'message': f'حقل {field} مطلوب.'}, status=400)
        
        msg = ContactMessage.objects.create(
            name=data['name'],
            email=data['email'],
            phone=data.get('phone', ''),
            subject=data['subject'],
            message=data['message']
        )
        
        return JsonResponse({
            'message': 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.',
            'id': msg.id
        }, status=201)
    
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)

@csrf_exempt
def api_contact_message_detail(request, msg_id):
    try:
        msg = ContactMessage.objects.get(id=msg_id)
    except ContactMessage.DoesNotExist:
        return JsonResponse({'message': 'Message not found.'}, status=404)
    
    user = verify_token(request)
    if not user:
        return JsonResponse({'message': 'Unauthorized'}, status=401)
    
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid JSON.'}, status=400)
        
        if 'is_read' in data:
            msg.is_read = data['is_read']
            msg.save()
        
        return JsonResponse({'message': 'Message updated successfully.'})
    
    elif request.method == 'DELETE':
        msg.delete()
        return JsonResponse({'message': 'Message deleted successfully.'})
    
    else:
        return JsonResponse({'message': 'Method not allowed.'}, status=405)
