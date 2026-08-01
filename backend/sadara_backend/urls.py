from django.contrib import admin
from django.urls import path
from core import views
from core.models import seed_db

urlpatterns = [
    # Static files and page serving to mimic original Flask logic
    path('dashbord', views.serve_dashbord_index),
    path('dashbord/', views.serve_dashbord_index),
    path('dashbord/<path:filename>', views.serve_dashbord_assets),
    path('assets/<path:filename>', views.serve_site_assets),
    path('css/<path:filename>', views.serve_site_css),
    path('js/<path:filename>', views.serve_site_js),
    path('<str:page>.html', views.serve_site_pages),
    path('', views.serve_root),

    # Authentication API endpoints
    path('api/auth/login', views.login),
    path('api/auth/me', views.get_me),

    # Settings API endpoints
    path('api/settings', views.handle_settings),

    # Applicants API endpoints
    path('api/applicants', views.handle_applicants),
    path('api/applicants/<int:applicant_id>', views.handle_applicant_detail),

    # File Upload API & Media Serving
    path('api/upload', views.api_upload),
    path('media/<path:filename>', views.serve_media_files),

    # Departments API endpoints
    path('api/departments', views.api_departments),
    path('api/departments/<int:dept_id>', views.api_department_detail),

    # Labs API endpoints
    path('api/labs', views.api_labs),
    path('api/labs/<int:lab_id>', views.api_lab_detail),

    # Tuition Fees API endpoints
    path('api/fees', views.api_fees),
    path('api/fees/<int:fee_id>', views.api_fee_detail),

    # Contact Messages API endpoints
    path('api/contact', views.api_contact_messages),
    path('api/contact/<int:msg_id>', views.api_contact_message_detail),
]

# Attempt database seeding on startup
try:
    seed_db()
except Exception as e:
    print(f"Warning: Database seeding skipped or failed (this is normal during migrations): {e}")
