from datetime import datetime, timedelta
from typing import Optional, Union, Any
from uuid import uuid4
from jose import jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.JWT_ALGORITHM

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Bcrypt has a 72-byte limit - truncate if needed
    password_bytes = plain_password.encode('utf-8')[:72]
    # Decode back to string (passlib expects string, not bytes)
    truncated_password = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.verify(truncated_password, hashed_password)

def get_password_hash(password: str) -> str:
    # Bcrypt has a 72-byte limit - truncate if needed
    password_bytes = password.encode('utf-8')[:72]
    # Decode back to string (passlib expects string, not bytes)
    truncated_password = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.hash(truncated_password)

def _create_token(subject: Union[str, Any], token_type: str, expires_delta: timedelta) -> str:
    expire = datetime.utcnow() + expires_delta
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": token_type,
        "jti": str(uuid4()),
    }
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    token_ttl = expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRES_MINUTES)
    return _create_token(subject, "access", token_ttl)

def create_refresh_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    token_ttl = expires_delta or timedelta(minutes=settings.JWT_REFRESH_TOKEN_EXPIRES_MINUTES)
    return _create_token(subject, "refresh", token_ttl)

def create_password_reset_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    expire_minutes = (
        expires_delta.total_seconds() / 60
        if expires_delta
        else settings.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES
    )
    expire = datetime.utcnow() + timedelta(minutes=expire_minutes)
    to_encode = {"exp": expire, "sub": str(subject), "type": "reset"}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)

def decode_password_reset_token(token: str) -> str:
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    if payload.get("type") != "reset":
        raise ValueError("Invalid token type")
    return str(payload.get("sub"))
