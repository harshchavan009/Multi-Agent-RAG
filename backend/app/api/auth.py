from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import secrets
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.models.schemas import User, Organization, Workspace, OrganizationMember, UserCreate, Token, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class VerifyEmailRequest(BaseModel):
    token: str

# RBAC helper dependency
class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization headers."
            )
        token = authorization.split(" ")[1]
        claims = decode_token(token)
        if not claims or "sub" not in claims:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token."
            )
        
        user = db.query(User).filter(User.email == claims["sub"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Find user organization role mapping
        member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
        user_role = member.role if member else "user"

        # Check if user role matches allowed roles
        # Roles levels: 'super_admin', 'admin', 'manager', 'user'
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden. Insufficient operational permissions."
            )
        return user

@router.post("/signup", response_model=UserResponse)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email address already exists.")

    verification_token = secrets.token_hex(32)

    # 1. Create User
    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        is_active=True,
        is_email_verified=False,
        email_verification_token=verification_token
    )
    db.add(new_user)
    db.flush()

    # 2. Organization mapping
    org_slug = payload.email.split("@")[0].lower() + "-org"
    new_org = Organization(name=f"{payload.first_name or 'Default'}'s Org", slug=org_slug)
    db.add(new_org)
    db.flush()

    # Default member role assigned as 'admin'
    member_map = OrganizationMember(organization_id=new_org.id, user_id=new_user.id, role="admin")
    db.add(member_map)

    # Default workspace
    new_workspace = Workspace(organization_id=new_org.id, name="Default Workspace", slug="default-workspace")
    db.add(new_workspace)

    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
    org_id = str(member.organization_id) if member else None
    role = member.role if member else "user"

    # Generate access and refresh tokens
    access_token = create_access_token(subject=user.email, org_id=org_id, role=role)
    refresh_token = secrets.token_hex(64)
    
    user.refresh_token = refresh_token
    db.commit()

    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    reset_token = None
    if user:
        reset_token = secrets.token_hex(32)
        user.password_reset_token = reset_token
        db.commit()
        # In production, send email with verification link containing reset_token
        print(f"[SMTP Mail Service] Password reset token generated for {user.email}: {reset_token}")
    return {
        "message": "If this email is registered, a recovery link has been generated.",
        "reset_token": reset_token
    }

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    
    user.password_hash = get_password_hash(payload.new_password)
    user.password_reset_token = None
    db.commit()
    return {"message": "Password updated successfully."}

@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email verification token.")
    
    user.is_email_verified = True
    user.email_verification_token = None
    db.commit()
    return {"message": "Email address successfully verified."}

@router.post("/refresh", response_model=Token)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.refresh_token == payload.refresh_token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh session.")

    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
    org_id = str(member.organization_id) if member else None
    role = member.role if member else "user"

    new_access_token = create_access_token(subject=user.email, org_id=org_id, role=role)
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.get("/session")
def get_session_info(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token missing.")
    token = authorization.split(" ")[1]
    print(f"DEBUG: Token: {token}")
    claims = decode_token(token)
    print(f"DEBUG: Decoded claims: {claims}")
    if not claims or "sub" not in claims:
        raise HTTPException(status_code=401, detail="Invalid authentication session.")
    
    print(f"DEBUG: Querying user with email: '{claims['sub']}'")
    user = db.query(User).filter(User.email == claims["sub"]).first()
    print(f"DEBUG: Query result: {user}")
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
    user_role = member.role if member else "user"
    org_id = str(member.organization_id) if member else None

    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_email_verified": user.is_email_verified,
        "role": user_role,
        "org_id": org_id
    }

class RoleUpdatePayload(BaseModel):
    role: str

@router.get("/users")
def get_org_users(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token missing.")
    token = authorization.split(" ")[1]
    claims = decode_token(token)
    if not claims or "sub" not in claims:
        raise HTTPException(status_code=401, detail="Invalid session token.")
    
    current_user = db.query(User).filter(User.email == claims["sub"]).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    current_member = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).first()
    if not current_member:
        raise HTTPException(status_code=403, detail="User not associated with any organization")
        
    org_id = current_member.organization_id
    
    # List all members of this organization
    members = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org_id).all()
    user_ids = [m.user_id for m in members]
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    
    # Create role mapping lookup
    role_map = {m.user_id: m.role for m in members}
    
    result = []
    for u in users:
        result.append({
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "is_active": u.is_active,
            "is_email_verified": u.is_email_verified,
            "role": role_map.get(u.id, "user"),
            "created_at": u.created_at
        })
    return result

@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: uuid.UUID,
    payload: RoleUpdatePayload,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # Enforce RBAC for changing roles (allowed: super_admin, admin)
    checker = RoleChecker(allowed_roles=["super_admin", "admin"])
    current_user = checker(authorization=authorization, db=db)
        
    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Organization member relationship not found.")
        
    # Check that the user is in the same organization
    current_member = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).first()
    if member.organization_id != current_member.organization_id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify roles in other organizations.")
        
    # Valid roles
    valid_roles = ["super_admin", "admin", "manager", "user"]
    if payload.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role designation. Must be one of {valid_roles}")
        
    member.role = payload.role
    db.commit()
    
    return {"message": "User role updated successfully.", "user_id": str(user_id), "new_role": payload.role}
