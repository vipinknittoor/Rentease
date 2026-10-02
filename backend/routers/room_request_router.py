from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from sqlalchemy.orm import Session

from database.db import get_db

from models.user import User

from schemas.room_request_schema import (
    RoomRequestCreate,
    RoomRequestResponse
)

from services.room_request_service import (
    get_available_rooms,
    create_room_request,
    get_my_room_request,
    get_pending_room_requests,
    accept_room_request,
    reject_room_request
)

from utils.jwt_handler import verify_access_token


router = APIRouter(
    prefix="/room-requests",
    tags=["Room Requests"]
)


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
    db: Session = Depends(get_db)
):



    token = credentials.credentials

    payload = verify_access_token(
        token
    )

    if payload is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    user_id = payload.get(
        "user_id"
    )

    if user_id is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid token."
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=401,
            detail="User not found."
        )

    return user

@router.get(
    "/available-rooms"
)
def get_available_room_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    if current_user.role != "tenant":

        raise HTTPException(
            status_code=403,
            detail="Only tenant users can request rooms."
        )

    return get_available_rooms(
        db
    )

@router.post(
    "/",
    response_model=RoomRequestResponse
)
def send_room_request(
    data: RoomRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    if current_user.role != "tenant":

        raise HTTPException(
            status_code=403,
            detail="Only tenant users can request rooms."
        )

    return create_room_request(
        db=db,
        user_id=current_user.id,
        room_id=data.room_id
    )

@router.get(
    "/my-request",
    response_model=RoomRequestResponse | None
)
def get_current_room_request(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    if current_user.role != "tenant":

        raise HTTPException(
            status_code=403,
            detail=(
                "Only tenant users can access "
                "room requests."
            )
        )


    return get_my_room_request(
        db=db,
        user_id=current_user.id
    )



@router.get(
    "/pending"
)
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    if current_user.role != "owner":

        raise HTTPException(
            status_code=403,
            detail="Only the owner can view room requests."
        )



    return get_pending_room_requests(
        db
    )



@router.post(
    "/{request_id}/accept"
)
def accept_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    if current_user.role != "owner":

        raise HTTPException(
            status_code=403,
            detail="Only the owner can accept requests."
        )

    return accept_room_request(
        db=db,
        request_id=request_id
    )


@router.post(
    "/{request_id}/reject"
)
def reject_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):


    if current_user.role != "owner":

        raise HTTPException(
            status_code=403,
            detail="Only the owner can reject requests."
        )


    return reject_room_request(
        db=db,
        request_id=request_id
    )