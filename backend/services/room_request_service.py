from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.room_request import RoomRequest
from models.room import Room
from models.tenant import Tenant
from models.user import User

def get_available_rooms(
    db: Session
):
    rooms = (
        db.query(Room)
        .filter(
            Room.status == "Vacant"
        )
        .order_by(
            Room.room_number
        )
        .all()
    )

    return rooms


def create_room_request(
    db: Session,
    user_id: int,
    room_id: int
):


    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

 

    existing_tenant = (
        db.query(Tenant)
        .filter(
            Tenant.user_id == user_id
        )
        .first()
    )

    if existing_tenant is not None:
        raise HTTPException(
            status_code=400,
            detail="You already have a room allocated."
        )

  

    existing_request = (
        db.query(RoomRequest)
        .filter(
            RoomRequest.user_id == user_id,
            RoomRequest.status == "Pending"
        )
        .first()
    )

    if existing_request is not None:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending room request."
        )

  

    room = (
        db.query(Room)
        .filter(
            Room.id == room_id
        )
        .first()
    )

    if room is None:
        raise HTTPException(
            status_code=404,
            detail="Room not found."
        )


    if room.status != "Vacant":
        raise HTTPException(
            status_code=400,
            detail="This room is no longer available."
        )


    room_request = RoomRequest(
        user_id=user_id,
        room_id=room_id,
        status="Pending"
    )

    db.add(room_request)
    db.commit()
    db.refresh(room_request)

    return room_request


def get_my_room_request(
    db: Session,
    user_id: int
):

    room_request = (
        db.query(RoomRequest)
        .filter(
            RoomRequest.user_id == user_id,
            RoomRequest.status == "Pending"
        )
        .order_by(
            RoomRequest.requested_at.desc()
        )
        .first()
    )

    return room_request


def get_pending_room_requests(
    db: Session
):

    requests = (
        db.query(
            RoomRequest,
            User,
            Room
        )
        .join(
            User,
            RoomRequest.user_id == User.id
        )
        .join(
            Room,
            RoomRequest.room_id == Room.id
        )
        .filter(
            RoomRequest.status == "Pending"
        )
        .order_by(
            RoomRequest.requested_at.asc()
        )
        .all()
    )

    result = []

    for room_request, user, room in requests:

        result.append({

            "id": room_request.id,

            "user_id": user.id,

            "full_name": user.full_name,

            "phone": user.phone,

            "email": user.email,

            "room_id": room.id,

            "room_number": room.room_number,

            "floor": room.floor,

            "monthly_rent": room.monthly_rent,

            "status": room_request.status,

            "requested_at": room_request.requested_at,

        })

    return result



def accept_room_request(
    db: Session,
    request_id: int
):


    room_request = (
        db.query(RoomRequest)
        .filter(
            RoomRequest.id == request_id
        )
        .first()
    )

    if room_request is None:

        raise HTTPException(
            status_code=404,
            detail="Room request not found."
        )


    if room_request.status != "Pending":

        raise HTTPException(
            status_code=400,
            detail=(
                "This room request has already "
                "been processed."
            )
        )


    user = (
        db.query(User)
        .filter(
            User.id == room_request.user_id
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="Requesting user not found."
        )


    existing_tenant = (
        db.query(Tenant)
        .filter(
            Tenant.user_id == user.id
        )
        .first()
    )

    if existing_tenant is not None:

        raise HTTPException(
            status_code=400,
            detail=(
                "This user already has a tenant profile."
            )
        )

    room = (
        db.query(Room)
        .filter(
            Room.id == room_request.room_id
        )
        .first()
    )

    if room is None:

        raise HTTPException(
            status_code=404,
            detail="Requested room not found."
        )

    if room.status != "Vacant":

        raise HTTPException(
            status_code=400,
            detail=(
                "This room is no longer available."
            )
        )

    new_tenant = Tenant(

        user_id=user.id,

        full_name=user.full_name,

        phone=user.phone,

        email=user.email,

        room_number=room.room_number,

        room_id=room.id,

        monthly_rent=room.monthly_rent,

        deposit=None,

        join_date=datetime.utcnow().date(),

        status="Active",

        previous_reading=0,

        current_reading=0,

        electricity_units=0,

        electricity_bill=0,

        extra_bill=0,

        billing_ready=False
    )

    db.add(new_tenant)


    room.status = "Occupied"

    room_request.status = "Accepted"

    room_request.responded_at = datetime.utcnow()


    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to accept room request."
            )
        )


    db.refresh(new_tenant)

    return {
        "message": "Room request accepted successfully.",
        "tenant_id": new_tenant.id,
        "room_id": room.id,
        "room_number": room.room_number,
        "status": room_request.status
    }


def reject_room_request(
    db: Session,
    request_id: int
):

    room_request = (
        db.query(RoomRequest)
        .filter(
            RoomRequest.id == request_id
        )
        .first()
    )

    if room_request is None:

        raise HTTPException(
            status_code=404,
            detail="Room request not found."
        )

    if room_request.status != "Pending":

        raise HTTPException(
            status_code=400,
            detail=(
                "This room request has already "
                "been processed."
            )
        )


    room_request.status = "Rejected"

    room_request.responded_at = datetime.utcnow()

    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to reject room request."
            )
        )

    return {
        "message": "Room request rejected successfully.",
        "request_id": room_request.id,
        "status": room_request.status
    }