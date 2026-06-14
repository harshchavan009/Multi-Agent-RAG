import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt
from app.core.config import settings

ALGORITHM = "HS256"

def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${hash_bytes.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt, orig_hash = hashed_password.split("$")
        check_hash_bytes = hashlib.pbkdf2_hmac('sha256', plain_password.encode(), salt.encode(), 100000)
        return check_hash_bytes.hex() == orig_hash
    except Exception:
        return False

def create_access_token(
    subject: Union[str, Any], 
    expires_delta: Optional[timedelta] = None,
    org_id: Optional[str] = None,
    role: Optional[str] = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {
        "exp": expire, 
        "sub": str(subject),
        "org_id": org_id,
        "role": role
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    try:
        decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return decoded
    except Exception:
        return None
