import sqlite3
import os
import bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), 'sadara.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # Create applicants table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS applicants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            gpa REAL NOT NULL,
            stream TEXT NOT NULL,
            department TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create users table for admin authentication
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'admin'
        )
    ''')
    
    # Seed default homepage settings if not already present
    default_settings = {
        'top_phone': '+967 777 777 777',
        'top_email': 'info@alsadara.edu.ye',
        'top_address': 'صنعاء، اليمن',
        'hero_tag': 'القبول والتسجيل مفتوح للعام الدراسي الجديد 2026/2027',
        'hero_title': 'كلية الصدارة للعلوم الطبية والتقنية',
        'hero_subtitle': 'صدارة التعليم لمستقبل واعد',
        'hero_desc': 'نحن في كلية الصدارة نسعى لتوفير بيئة تعليمية أكاديمية متطورة تدمج بين الجانب النظري المبتكر والتطبيق العملي المكثف في أحدث المختبرات والمنشآت لتخريج نخبة من الكفاءات الطبية والتقنية.',
        'countdown_end': '2026-09-30T23:59:59',
        'stat_students': '5000',
        'stat_depts': '11',
        'stat_employment': '98',
        'stat_labs': '16',
        'social_facebook': '#',
        'social_twitter': '#',
        'social_linkedin': '#',
        'social_youtube': '#'
    }
    
    for key, val in default_settings.items():
        cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (key, val))
        
    # Seed default applicants to match front-end demo data
    default_applicants = [
        ('خالد عبد الوهاب المرادي', '+967 771 234 567', 89.5, 'scientific', 'صيدلة'),
        ('هدى أحمد الشرفي', '+967 775 987 654', 94.2, 'scientific', 'تقنية معلومات (IT)'),
        ('علي يحيى الذماري', '+967 773 456 789', 81.0, 'scientific', 'فني أسنان'),
        ('بلقيس صالح المطري', '+967 770 111 222', 88.4, 'scientific', 'قبالة وتوليد'),
        ('مازن محمد الخولاني', '+967 777 999 888', 85.7, 'scientific', 'مساعد طبي')
    ]
    
    cursor.execute('SELECT COUNT(*) FROM applicants')
    if cursor.fetchone()[0] == 0:
        for name, phone, gpa, stream, dept in default_applicants:
            cursor.execute('''
                INSERT INTO applicants (name, phone, gpa, stream, department, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            ''', (name, phone, gpa, stream, dept))
            
    # Seed default admin user (username: admin, password: admin_sadara_2026)
    cursor.execute('SELECT COUNT(*) FROM users WHERE username = ?', ('admin',))
    if cursor.fetchone()[0] == 0:
        hashed = bcrypt.hashpw('admin_sadara_2026'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute('''
            INSERT INTO users (username, password_hash, full_name, role)
            VALUES (?, ?, ?, ?)
        ''', ('admin', hashed, 'أ.د. فيصل عائض', 'superuser'))
        
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

if __name__ == '__main__':
    init_db()
