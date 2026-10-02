import secrets
from datetime import datetime, timedelta

from jose import jwt, JWTError


# TODO:
# Move this value to an environment variable in production.
SECRET_KEY = "rentease_super_secret_key_2026"

ALGORITHM = "HS256"



# Access token is intentionally short-lived.
# The frontend will use the refresh token to obtain
# a new access token when this expires.
ACCESS_TOKEN_EXPIRE_MINUTES = 15

# Refresh token remains valid for 7 days.
REFRESH_TOKEN_EXPIRE_DAYS = 7


# CREATE ACCESS TOKEN


def create_access_token(data: dict):
    """
    Creates a short-lived JWT access token.

    Access token lifetime:
        15 minutes
    """

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "exp": expire,
        "token_type": "access"
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )



# CREATE REFRESH TOKEN


def create_refresh_token(data: dict):
    """
    Creates a long-lived JWT refresh token.

    Refresh token lifetime:
        7 days

    A unique JTI is added to every refresh token.
    The JTI will later be used for refresh-token
    rotation and revocation.
    """

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )

    # Generating a unique identifier for this refresh token.
    jti = secrets.token_urlsafe(32)

    to_encode.update({
        "exp": expire,
        "token_type": "refresh",
        "jti": jti
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# VERIFY ACCESS TOKEN


def verify_access_token(token: str):
    """
    Verifies an access token.

    Returns:
        JWT payload if valid
        None if invalid or expired
    """

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # Make sure this is actually an access token.
        if payload.get("token_type") != "access":
            return None

        return payload

    except JWTError:

        return None



# VERIFY REFRESH TOKEN


def verify_refresh_token(token: str):
    """
    Verifies a refresh token.

    Returns:
        JWT payload if valid
        None if invalid or expired
    """

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # Make sure this is actually a refresh token.
        if payload.get("token_type") != "refresh":
            return None

        # A refresh token must contain a JTI.
        if not payload.get("jti"):
            return None

        return payload

    except JWTError:

        return None