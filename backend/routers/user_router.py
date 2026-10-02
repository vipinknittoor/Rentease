from fastapi import (
    APIRouter,
    Depends,
    Request,
    HTTPException,
    Response,
    Cookie
)

from sqlalchemy.orm import Session

from database.db import get_db

from models.user import User
from models.refresh_token import RefreshToken

from schemas.user_schema import (
    UserCreate,
    UserResponse,
    UserLogin,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    CaptchaResponse
)

from services.user_service import (
    create_user,
    login_user,
    create_password_reset_token,
    reset_password
)

from services.captcha_service import (
    generate_captcha,
    verify_captcha
)

from services.rate_limit import limiter

from services.email_service import (
    send_password_reset_email
)

from utils.jwt_handler import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token
)


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


REFRESH_COOKIE_NAME = "refresh_token"

REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60

REFRESH_COOKIE_SECURE = False

REFRESH_COOKIE_SAMESITE = "lax"

REFRESH_COOKIE_PATH = "/users"


@router.get(
    "/captcha",
    response_model=CaptchaResponse
)
def get_captcha():

    return generate_captcha()


@router.post(
    "/register",
    response_model=UserResponse
)
@limiter.limit("3/minute")
def register_user(
    request: Request,
    user: UserCreate,
    db: Session = Depends(get_db)
):

    if not verify_captcha(
        user.captcha_id,
        user.captcha_answer
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired CAPTCHA."
        )

    return create_user(
        db,
        user
    )

@router.post("/login")
@limiter.limit("5/minute")
def user_login(
    request: Request,
    response: Response,
    user: UserLogin,
    db: Session = Depends(get_db)
):


    if not verify_captcha(
        user.captcha_id,
        user.captcha_answer
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired CAPTCHA."
        )

    login_response = login_user(
        db,
        user
    )

    refresh_token = login_response.pop(
        "_refresh_token",
        None
    )

    if refresh_token is None:

        raise HTTPException(
            status_code=500,
            detail="Failed to create refresh token"
        )


    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=REFRESH_COOKIE_SECURE,
        samesite=REFRESH_COOKIE_SAMESITE,
        path=REFRESH_COOKIE_PATH
    )

    
    return login_response



@router.post("/refresh-token")
def refresh_access_token(
    response: Response,
    refresh_token: str | None = Cookie(
        default=None
    ),
    db: Session = Depends(get_db)
):



    if not refresh_token:

        raise HTTPException(
            status_code=401,
            detail="Refresh token not found"
        )

   

    payload = verify_refresh_token(
        refresh_token
    )

    if payload is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    user_id = payload.get("user_id")
    email = payload.get("email")
    role = payload.get("role")
    old_jti = payload.get("jti")


    if (
        user_id is None
        or email is None
        or role is None
        or old_jti is None
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token"
        )

    stored_token = db.query(
        RefreshToken
    ).filter(
        RefreshToken.jti == old_jti,
        RefreshToken.user_id == user_id
    ).first()

    if stored_token is None:

        raise HTTPException(
            status_code=401,
            detail="Refresh token has been revoked or is invalid"
        )

   

    if stored_token.revoked:

        raise HTTPException(
            status_code=401,
            detail="Refresh token has been revoked"
        )


    from datetime import datetime

    if stored_token.expires_at <= datetime.utcnow():

        stored_token.revoked = True

        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Refresh token has expired"
        )

    

    stored_token.revoked = True


    token_data = {
        "user_id": user_id,
        "email": email,
        "role": role
    }

    

    new_access_token = create_access_token(
        token_data
    )


    new_refresh_token = create_refresh_token(
        token_data
    )

  

    new_refresh_payload = verify_refresh_token(
        new_refresh_token
    )

    if new_refresh_payload is None:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to create new refresh token"
        )

    new_jti = new_refresh_payload.get("jti")
    new_exp = new_refresh_payload.get("exp")

    if not new_jti or not new_exp:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Invalid new refresh token"
        )

   

    from datetime import datetime

    new_refresh_record = RefreshToken(
        user_id=user_id,
        jti=new_jti,
        expires_at=datetime.fromtimestamp(
            new_exp
        ),
        revoked=False
    )

    db.add(new_refresh_record)

   

    db.commit()

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=new_refresh_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=REFRESH_COOKIE_SECURE,
        samesite=REFRESH_COOKIE_SAMESITE,
        path=REFRESH_COOKIE_PATH
    )



    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout_user(
    response: Response,
    refresh_token: str | None = Cookie(
        default=None
    ),
    db: Session = Depends(get_db)
):

    if refresh_token:

    

        payload = verify_refresh_token(
            refresh_token
        )

        if payload:

            jti = payload.get("jti")


            if jti:

                stored_token = db.query(
                    RefreshToken
                ).filter(
                    RefreshToken.jti == jti
                ).first()

                if stored_token:

                    stored_token.revoked = True

                    db.commit()


    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH
    )

    return {
        "message": "Logged out successfully"
    }


@router.get(
    "/registered-tenants",
    response_model=list[UserResponse]
)
def get_registered_tenant_users(
    db: Session = Depends(get_db)
):

    users = db.query(User).filter(
        User.role == "tenant"
    ).order_by(
        User.full_name.asc()
    ).all()

    return users



@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):

    raw_token = create_password_reset_token(
        db,
        data.email
    )

    if raw_token is None:

        return {
            "message": (
                "If an account exists with this email, "
                "a password reset link has been sent."
            )
        }



    reset_link = (
        "http://localhost:5173/reset-password"
        f"?token={raw_token}"
    )


    send_password_reset_email(
        recipient_email=data.email,
        reset_link=reset_link
    )

   

    return {
        "message": (
            "If an account exists with this email, "
            "a password reset link has been sent."
        )
    }




@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_user_password(
    request: Request,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):


    return reset_password(
        db,
        data.token,
        data.new_password
    )