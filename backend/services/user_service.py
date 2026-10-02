import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from fastapi import HTTPException

from models.user import User
from models.tenant import Tenant
from models.password_reset_token import PasswordResetToken
from models.refresh_token import RefreshToken

from utils.jwt_handler import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token
)

from schemas.user_schema import (
    UserCreate,
    UserLogin
)

from utils.password import (
    hash_password,
    verify_password
)


def create_user(
    db: Session,
    user: UserCreate
):


    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )


    existing_phone = db.query(User).filter(
        User.phone == user.phone
    ).first()

    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number already registered"
        )


    new_user = User(
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        password=hash_password(user.password),
        role=user.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

  

    if user.role == "tenant":

        tenant = db.query(Tenant).filter(
            Tenant.email == user.email
        ).first()

        if tenant and tenant.user_id is None:

            tenant.user_id = new_user.id

            db.commit()

   

    elif user.role == "owner":

        pass

    return new_user




def login_user(
    db: Session,
    user: UserLogin
):

   

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

  

    if not verify_password(
        user.password,
        existing_user.password
    ):

        raise HTTPException(
            status_code=401,
            detail="Incorrect password"
        )

    

    token_data = {
        "user_id": existing_user.id,
        "email": existing_user.email,
        "role": existing_user.role
    }

  

    access_token = create_access_token(
        token_data
    )

   

    refresh_token = create_refresh_token(
        token_data
    )


    refresh_payload = verify_refresh_token(
        refresh_token
    )

    if refresh_payload is None:

        raise HTTPException(
            status_code=500,
            detail="Failed to create refresh token"
        )

    

    jti = refresh_payload.get("jti")

    if not jti:

        raise HTTPException(
            status_code=500,
            detail="Refresh token JTI is missing"
        )

    

    expires_at_timestamp = refresh_payload.get("exp")

    if not expires_at_timestamp:

        raise HTTPException(
            status_code=500,
            detail="Refresh token expiration is missing"
        )

  

    expires_at = datetime.fromtimestamp(
        expires_at_timestamp
    )

    

    refresh_token_record = RefreshToken(
        user_id=existing_user.id,
        jti=jti,
        expires_at=expires_at,
        revoked=False
    )

    db.add(refresh_token_record)
    db.commit()

   

    return {
        "access_token": access_token,

        "token_type": "bearer",

        "id": existing_user.id,

        "full_name": existing_user.full_name,

        "email": existing_user.email,

        "role": existing_user.role,

        "_refresh_token": refresh_token
    }




def create_password_reset_token(
    db: Session,
    email: str
):


    existing_user = db.query(User).filter(
        User.email == email
    ).first()


    if existing_user is None:
        return None


    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == existing_user.id
    ).delete(
        synchronize_session=False
    )



    raw_token = secrets.token_urlsafe(32)

   

    hashed_token = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    

    expires_at = datetime.utcnow() + timedelta(
        minutes=30
    )

    

    reset_token = PasswordResetToken(
        user_id=existing_user.id,
        token=hashed_token,
        expires_at=expires_at
    )

    db.add(reset_token)

    db.commit()

  

    return raw_token




def verify_password_reset_token(
    db: Session,
    raw_token: str
):

    

    if not raw_token:

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link"
        )



    hashed_token = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    

    reset_token = db.query(
        PasswordResetToken
    ).filter(
        PasswordResetToken.token == hashed_token
    ).first()

   

    if reset_token is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link"
        )

  

    if reset_token.expires_at <= datetime.utcnow():

        db.delete(reset_token)
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link"
        )

 

    user = db.query(User).filter(
        User.id == reset_token.user_id
    ).first()

   

    if user is None:

        db.delete(reset_token)
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset link"
        )

    return reset_token, user




def reset_password(
    db: Session,
    raw_token: str,
    new_password: str
):

    

    reset_token, user = verify_password_reset_token(
        db,
        raw_token
    )



    user.password = hash_password(
        new_password
    )

  

    db.delete(reset_token)

  

    db.commit()

   

    return {
        "message": "Password reset successfully"
    }