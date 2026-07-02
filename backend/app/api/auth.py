from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import secrets
import os
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token
from app.models.schemas import User, Organization, Workspace, OrganizationMember, UserCreate, Token, UserResponse
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

class InvitePayload(BaseModel):
    email: str
    role: str  # admin, manager, user
    workspace_id: Optional[str] = None

class WorkspaceCreatePayload(BaseModel):
    name: str

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login-form",
    auto_error=False
)

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

    def __call__(self, token: Optional[str] = Depends(reusable_oauth2), db: Session = Depends(get_db)):
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization credentials."
            )
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
def get_session_info(token: Optional[str] = Depends(reusable_oauth2), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token missing.")
    claims = decode_token(token)
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
def get_org_users(token: Optional[str] = Depends(reusable_oauth2), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token missing.")
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
    token: Optional[str] = Depends(reusable_oauth2),
    db: Session = Depends(get_db)
):
    # Enforce RBAC for changing roles (allowed: super_admin, admin)
    checker = RoleChecker(allowed_roles=["super_admin", "admin"])
    current_user = checker(token=token, db=db)
        
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

@router.post("/invite")
def invite_user(
    payload: InvitePayload,
    token: Optional[str] = Depends(reusable_oauth2),
    db: Session = Depends(get_db)
):
    # Enforce admin / super_admin permissions using RoleChecker
    checker = RoleChecker(allowed_roles=["super_admin", "admin", "org_admin"])
    current_user = checker(token=token, db=db)
    
    # Get current organization ID from caller
    caller_member = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).first()
    if not caller_member:
        raise HTTPException(status_code=403, detail="Caller has no organization associated.")
    org_id = caller_member.organization_id

    # Check if target user exists in postgres
    target_user = db.query(User).filter(User.email == payload.email).first()
    
    status_msg = ""
    temp_password = None
    if not target_user:
        # Create a new user with temporary credentials
        temp_password = "IntelFlowWelcome123!"
        verification_token = secrets.token_hex(32)
        target_user = User(
            email=payload.email,
            password_hash=get_password_hash(temp_password),
            first_name="Invited",
            last_name="Member",
            is_active=True,
            is_email_verified=True,  # Auto-verify to bypass verification step in dev/test flows
            email_verification_token=verification_token
        )
        db.add(target_user)
        db.flush()
        status_msg = "Created new tenant user profile."
    else:
        status_msg = "User already registered. Linked to current organization."

    # Check if already a member of this organization
    existing_membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == target_user.id
    ).first()
    
    if not existing_membership:
        new_membership = OrganizationMember(
            organization_id=org_id,
            user_id=target_user.id,
            role=payload.role
        )
        db.add(new_membership)
        
    db.commit()
    db.refresh(target_user)
    
    # Print password credentials to standard logs for easy developer test copy-pasting
    if temp_password:
        print(f"[Identity Studio Invite] Invited {payload.email} with temporary credentials: {temp_password}")
        
    return {
        "status": "success",
        "message": status_msg,
        "email": target_user.email,
        "user_id": str(target_user.id),
        "temporary_password": temp_password
    }

@router.get("/workspaces")
def get_workspaces(
    token: Optional[str] = Depends(reusable_oauth2),
    db: Session = Depends(get_db)
):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token missing.")
    claims = decode_token(token)
    if not claims or "sub" not in claims:
        raise HTTPException(status_code=401, detail="Invalid session token.")
    
    user = db.query(User).filter(User.email == claims["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="User not associated with any organization")
        
    workspaces = db.query(Workspace).filter(Workspace.organization_id == member.organization_id).all()
    return [{
        "id": str(w.id),
        "name": w.name,
        "slug": w.slug,
        "organization_id": str(w.organization_id),
        "created_at": w.created_at
    } for w in workspaces]

@router.post("/workspaces")
def create_workspace(
    payload: WorkspaceCreatePayload,
    token: Optional[str] = Depends(reusable_oauth2),
    db: Session = Depends(get_db)
):
    checker = RoleChecker(allowed_roles=["super_admin", "admin", "org_admin", "manager"])
    current_user = checker(token=token, db=db)
    
    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="User has no organization context.")
        
    slug = payload.name.lower().replace(" ", "-").replace("_", "-")
    
    # Check if slug exists in org
    existing_ws = db.query(Workspace).filter(
        Workspace.organization_id == member.organization_id,
        Workspace.slug == slug
    ).first()
    if existing_ws:
        raise HTTPException(status_code=400, detail="A workspace with this name or slug already exists.")
        
    new_ws = Workspace(
        organization_id=member.organization_id,
        name=payload.name,
        slug=slug,
        settings={}
    )
    db.add(new_ws)
    db.commit()
    db.refresh(new_ws)
    
    return {
        "id": str(new_ws.id),
        "name": new_ws.name,
        "slug": new_ws.slug,
        "organization_id": str(new_ws.organization_id)
    }
@router.post("/login-form", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Standard OAuth2 form-urlencoded token endpoint (used by Swagger UI Authorize lock)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
    org_id = str(member.organization_id) if member else None
    role = member.role if member else "user"

    access_token = create_access_token(subject=user.email, org_id=org_id, role=role)
    refresh_token = secrets.token_hex(64)
    
    user.refresh_token = refresh_token
    db.commit()

    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}

@router.get("/oauth/{provider}/login")
def oauth_login(provider: str):
    # Check settings for Client IDs to perform real Google / GitHub OAuth redirects
    google_id = os.getenv("GOOGLE_CLIENT_ID")
    github_id = os.getenv("GITHUB_CLIENT_ID")
    
    from fastapi.responses import RedirectResponse
    
    if provider == "google" and google_id:
        redirect_uri = "http://localhost:3000/login"
        url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={google_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope=openid%20email%20profile"
        )
        return RedirectResponse(url=url)
        
    elif provider == "github" and github_id:
        redirect_uri = "http://localhost:3000/login"
        url = (
            f"https://github.com/login/oauth/authorize?"
            f"client_id={github_id}&"
            f"redirect_uri={redirect_uri}&"
            f"scope=user:email"
        )
        return RedirectResponse(url=url)
        
    else:
        # Development / Sandbox mock mode callback fallback
        mock_code = f"mock_{secrets.token_hex(16)}"
        callback_url = f"http://localhost:3000/login?provider={provider}&code={mock_code}"
        return RedirectResponse(url=callback_url)

@router.get("/oauth/{provider}/callback", response_model=Token)
def oauth_callback(provider: str, code: str, db: Session = Depends(get_db)):
    email = None
    first_name = "OAuth"
    last_name = provider.capitalize()
    
    google_id = os.getenv("GOOGLE_CLIENT_ID")
    google_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    github_id = os.getenv("GITHUB_CLIENT_ID")
    github_secret = os.getenv("GITHUB_CLIENT_SECRET")
    
    if code.startswith("mock_") or (provider == "google" and not google_id) or (provider == "github" and not github_id):
        # Mock mode fallback
        email = f"developer-{provider}@company.com"
        first_name = "Developer"
        last_name = provider.capitalize()
    else:
        # Real OAuth token exchange
        import httpx
        try:
            if provider == "google":
                token_res = httpx.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": google_id,
                        "client_secret": google_secret,
                        "redirect_uri": "http://localhost:3000/login",
                        "grant_type": "authorization_code"
                    },
                    timeout=10.0
                )
                token_data = token_res.json()
                id_token = token_data.get("id_token")
                # Verify id_token
                verify_res = httpx.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}", timeout=10.0)
                profile = verify_res.json()
                email = profile.get("email")
                first_name = profile.get("given_name", "Google")
                last_name = profile.get("family_name", "User")
            elif provider == "github":
                token_res = httpx.post(
                    "https://github.com/login/oauth/access_token",
                    headers={"Accept": "application/json"},
                    data={
                        "code": code,
                        "client_id": github_id,
                        "client_secret": github_secret,
                        "redirect_uri": "http://localhost:3000/login"
                    },
                    timeout=10.0
                )
                token_data = token_res.json()
                access_token = token_data.get("access_token")
                # Get email
                email_res = httpx.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"token {access_token}"},
                    timeout=10.0
                )
                emails = email_res.json()
                primary = [e for e in emails if e.get("primary")]
                email = primary[0]["email"] if primary else emails[0]["email"]
                first_name = "GitHub"
                last_name = "User"
        except Exception as oauth_err:
            print(f"[OAuth Exchange Error] {oauth_err}")
            raise HTTPException(status_code=400, detail=f"Failed to authenticate with {provider}: {str(oauth_err)}")
            
    if not email:
        raise HTTPException(status_code=400, detail=f"No email profile retrieved from {provider} scope authorization.")
        
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            password_hash=get_password_hash(secrets.token_urlsafe(32)),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_email_verified=True
        )
        db.add(user)
        db.flush()
        
        # Default organization mapping
        org_slug = f"developer-{provider}-org"
        new_org = Organization(name=f"{first_name}'s {provider.capitalize()} Org", slug=org_slug)
        db.add(new_org)
        db.flush()
        
        member_map = OrganizationMember(organization_id=new_org.id, user_id=user.id, role="admin")
        db.add(member_map)
        
        new_workspace = Workspace(organization_id=new_org.id, name="Default Workspace", slug="default-workspace")
        db.add(new_workspace)
        
        db.commit()
        db.refresh(user)

    access_token = create_access_token(subject=user.email, org_id=org_id, role=role)
    refresh_token = secrets.token_hex(64)
    
    user.refresh_token = refresh_token
    db.commit()

    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}


class ProfileUpdatePayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

@router.put("/profile")
def update_profile(
    payload: ProfileUpdatePayload,
    token: Optional[str] = Depends(reusable_oauth2),
    db: Session = Depends(get_db)
):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token missing.")
    claims = decode_token(token)
    if not claims or "sub" not in claims:
        raise HTTPException(status_code=401, detail="Invalid session token.")
    
    user = db.query(User).filter(User.email == claims["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
        
    db.commit()
    db.refresh(user)
    return {"message": "Profile updated successfully.", "first_name": user.first_name, "last_name": user.last_name}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: uuid.UUID,
    token: Optional[str] = Depends(reusable_oauth2),
    db: Session = Depends(get_db)
):
    checker = RoleChecker(allowed_roles=["super_admin", "admin"])
    current_user = checker(token=token, db=db)
    
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
        
    current_member = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).first()
    target_member = db.query(OrganizationMember).filter(OrganizationMember.user_id == user_id).first()
    
    if not target_member or target_member.organization_id != current_member.organization_id:
        raise HTTPException(status_code=403, detail="Forbidden. User does not belong to your organization.")
        
    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrative user profile.")
        
    db.delete(user_to_delete)
    db.commit()
    return {"message": "User deleted successfully."}

