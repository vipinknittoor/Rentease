from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from utils.jwt_handler import verify_access_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    payload = verify_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    return payload


def get_current_owner(
    current_user=Depends(get_current_user)
):

    if current_user["role"] != "owner":
        raise HTTPException(
            status_code=403,
            detail="Owner access only"
        )

    return current_user


def get_current_tenant(
    current_user=Depends(get_current_user)
):

    if current_user["role"] != "tenant":
        raise HTTPException(
            status_code=403,
            detail="Tenant access only"
        )

    return current_user