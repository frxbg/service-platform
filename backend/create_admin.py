"""
Create initial admin user
Run this with: python create_admin.py
"""
from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_admin_user():
    db = SessionLocal()
    try:
        # Check if admin exists
        existing = db.query(User).filter(User.email == "admin@pyoffer.com").first()
        if existing:
            print("Admin user already exists!")
            return
        
        # Create admin user
        admin = User(
            email="admin@pyoffer.com",
            password_hash=get_password_hash("Admin123!"),
            role="admin",
            user_code="ADMIN",
            is_active=True
        )

        db.add(admin)
        db.commit()
        print("✅ Admin user created successfully!")
        print("Email: admin@pyoffer.com")
        print("Password: Admin123!")
        print("\n⚠️  IMPORTANT: Change this password after first login!")

        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
