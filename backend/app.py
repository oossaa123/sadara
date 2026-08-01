import os
import jwt
import datetime
import bcrypt
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import get_db_connection, init_db

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

@app.after_request
def add_header(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

JWT_SECRET = 'sadara_secret_key_2026_tech_innovation'

# Helper decorator for JWT verification
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Missing authorization token.'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            # Fetch user from db
            conn = get_db_connection()
            user = conn.execute('SELECT * FROM users WHERE id = ?', (data['user_id'],)).fetchone()
            conn.close()
            if not user:
                return jsonify({'message': 'Invalid user token.'}), 401
            current_user = dict(user)
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token.'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

# ==========================================
# 1. Static Files Serving Logic
# ==========================================

# Route for serving the dashboard homepage
@app.route('/dashbord')
@app.route('/dashbord/')
def serve_dashbord_index():
    return send_from_directory('../dashbord', 'index.html')

# Route for serving dashboard files (css, js, assets, etc.)
@app.route('/dashbord/<path:filename>')
def serve_dashbord_assets(filename):
    # If file exists in dashbord folder, serve it
    dashbord_dir = os.path.abspath('../dashbord')
    target_path = os.path.join(dashbord_dir, filename)
    if os.path.exists(target_path) and os.path.isfile(target_path):
        return send_from_directory('../dashbord', filename)
    # Default fallback to index.html for SPA router (if any)
    return send_from_directory('../dashbord', 'index.html')

# Route for serving site assets
@app.route('/assets/<path:filename>')
def serve_site_assets(filename):
    return send_from_directory('../sadara/assets', filename)

# Route for serving main website files (css, js)
@app.route('/css/<path:filename>')
def serve_site_css(filename):
    return send_from_directory('../sadara/css', filename)

@app.route('/js/<path:filename>')
def serve_site_js(filename):
    return send_from_directory('../sadara/js', filename)

# Route for main website pages (about.html, contact.html, etc.)
@app.route('/<string:page>.html')
def serve_site_pages(page):
    sadara_dir = os.path.abspath('../sadara')
    target_file = f"{page}.html"
    if os.path.exists(os.path.join(sadara_dir, target_file)):
        return send_from_directory('../sadara', target_file)
    return send_from_directory('../sadara', 'index.html')

# Root route serves the main site index
@app.route('/')
def serve_root():
    return send_from_directory('../sadara', 'index.html')

# ==========================================
# 2. Authentication API endpoints
# ==========================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'message': 'Username and password are required.'}), 400
        
    username = data['username']
    password = data['password']
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'message': 'Invalid username or password.'}), 401
        
    # Check password
    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        token = jwt.encode({
            'user_id': user['id'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, JWT_SECRET, algorithm="HS256")
        
        return jsonify({
            'token': token,
            'user': {
                'username': user['username'],
                'full_name': user['full_name'],
                'role': user['role']
            }
        })
        
    return jsonify({'message': 'Invalid username or password.'}), 401

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_me(current_user):
    return jsonify({
        'username': current_user['username'],
        'full_name': current_user['full_name'],
        'role': current_user['role']
    })

# ==========================================
# 3. Homepage Settings API endpoints
# ==========================================

@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = get_db_connection()
    rows = conn.execute('SELECT key, value FROM settings').fetchall()
    conn.close()
    
    settings_dict = {row['key']: row['value'] for row in rows}
    return jsonify(settings_dict)

@app.route('/api/settings', methods=['POST'])
@token_required
def update_settings(current_user):
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided.'}), 400
        
    conn = get_db_connection()
    for key, value in data.items():
        # Update setting or insert if not exists
        conn.execute('''
            INSERT INTO settings (key, value) 
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ''', (key, str(value)))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Homepage settings updated successfully.'})

# ==========================================
# 4. Applicants API endpoints
# ==========================================

@app.route('/api/applicants', methods=['GET'])
@token_required
def get_applicants(current_user):
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM applicants ORDER BY id DESC').fetchall()
    conn.close()
    
    applicants_list = [dict(row) for row in rows]
    return jsonify(applicants_list)

@app.route('/api/applicants', methods=['POST'])
def create_applicant():
    data = request.get_json()
    required = ['name', 'phone', 'gpa', 'stream', 'department']
    if not data or not all(k in data for k in required):
        return jsonify({'message': 'All applicant fields are required.'}), 400
        
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO applicants (name, phone, gpa, stream, department, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    ''', (data['name'], data['phone'], float(data['gpa']), data['stream'], data['department']))
    conn.commit()
    
    # Get current pending counts for statistics update
    pending = conn.execute("SELECT COUNT(*) FROM applicants WHERE status = 'pending'").fetchone()[0]
    conn.close()
    
    return jsonify({
        'message': 'Application submitted successfully.',
        'pending_count': pending
    }), 201

@app.route('/api/applicants/<int:applicant_id>', methods=['PUT'])
@token_required
def update_applicant_status(current_user, applicant_id):
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'message': 'Status field is required.'}), 400
        
    status = data['status']
    if status not in ['pending', 'approved', 'rejected']:
        return jsonify({'message': 'Invalid status value.'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE applicants SET status = ? WHERE id = ?', (status, applicant_id))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'message': 'Applicant not found.'}), 404
        
    conn.commit()
    
    # Fetch applicant details to return updated info
    row = conn.execute('SELECT * FROM applicants WHERE id = ?', (applicant_id,)).fetchone()
    conn.close()
    
    return jsonify({
        'message': f'Applicant status updated to {status}.',
        'applicant': dict(row)
    })

@app.route('/api/applicants/<int:applicant_id>', methods=['DELETE'])
@token_required
def delete_applicant(current_user, applicant_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM applicants WHERE id = ?', (applicant_id,))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'message': 'Applicant not found.'}), 404
    conn.commit()
    conn.close()
    return jsonify({'message': 'Applicant deleted successfully.'})

if __name__ == '__main__':
    # Initialize DB schema before starting app
    init_db()
    # Run the server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
