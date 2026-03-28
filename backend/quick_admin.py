"""
Quick admin creation using SQL
Password: admin123
"""
import subprocess

# This hash is for password "admin123" - generated using FastAPI's passlib bcrypt
PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"

cmd = f"""docker exec pyoffer-db-1 psql -U postgres -d pyoffer -c "INSERT INTO users (id, email, password_hash, role, user_code, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'admin@pyoffer.com', '{PASSWORD_HASH}', 'ADMIN', 'ADMIN', true, NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash;" """

result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
print(result.stdout)
if result.returncode == 0:
    print("✅ Admin created successfully!")
    print("Email: admin@pyoffer.com")
    print("Password: admin123")
else:
    print(f"❌ Error: {result.stderr}")
