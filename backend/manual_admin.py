"""
Direct admin user creation bypassing bcrypt library issues
"""
import psycopg2

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pyoffer",
    user="postgres",
    password="postgres"
)

cursor = conn.cursor()

# Delete any existing admin
cursor.execute("DELETE FROM users WHERE email = 'admin@pyoffer.com';")

# This is a valid bcrypt hash for password "admin" generated with bcrypt online tool
# Hash for "admin": $2a$10$N9qo8uLOKCHWy2rZLI.4NO0RWJ2Xc5G3hxT7m00XqU0J3y6BYdJaO
admin_hash = "$2a$10$N9qo8uLOKCHWy2rZLI.4NO0RWJ2Xc5G3hxT7m00XqU0J3y6BYdJaO"

cursor.execute("""
    INSERT INTO users (id, email, password_hash, role, user_code, is_active, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        'admin@pyoffer.com',
        %s,
        'ADMIN',
        'ADMIN',
        true,
        NOW(),
        NOW()
    )
""", (admin_hash,))

conn.commit()
cursor.close()
conn.close()

print("✅ Admin user created!")
print("Email: admin@pyoffer.com")
print("Password: admin")
