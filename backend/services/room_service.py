from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.room import Room
from models.tenant import Tenant
from models.payment import Payment

from schemas.room_schema import RoomCreate


def create_room(
    db: Session,
    room_data: RoomCreate
):

    new_room = Room(
        room_number=room_data.room_number,
        floor=room_data.floor,
        room_type=room_data.room_type,
        capacity=room_data.capacity,
        monthly_rent=room_data.monthly_rent,
        status="Vacant"
    )

    db.add(new_room)

    db.commit()

    db.refresh(new_room)

    return new_room


def get_rooms(
    db: Session
):

    return (
        db.query(Room)
        .order_by(Room.room_number)
        .all()
    )


def get_room(
    db: Session,
    room_id: int
):

    return (
        db.query(Room)
        .filter(Room.id == room_id)
        .first()
    )


def update_room(
    db: Session,
    room_id: int,
    room_data: RoomCreate
):

    room = (
        db.query(Room)
        .filter(Room.id == room_id)
        .first()
    )

    if room is None:
        return None

    old_rent = room.monthly_rent

    room.room_number = room_data.room_number

    room.floor = room_data.floor

    room.room_type = room_data.room_type

    room.capacity = room_data.capacity

    room.monthly_rent = room_data.monthly_rent

    if old_rent != room_data.monthly_rent:

        tenants = (
            db.query(Tenant)
            .filter(
                Tenant.room_id == room.id
            )
            .all()
        )

        for tenant in tenants:

            tenant.monthly_rent = (
                room_data.monthly_rent
            )

            pending_payment = (
                db.query(Payment)
                .filter(
                    Payment.tenant_id == tenant.id,
                    Payment.status == "Pending"
                )
                .first()
            )

            if pending_payment:

                pending_payment.monthly_rent = (
                    room_data.monthly_rent
                )

                pending_payment.total_amount = (
                    float(room_data.monthly_rent)
                    +
                    float(tenant.electricity_bill)
                )

    db.commit()

    db.refresh(room)

    return room


def delete_room(
    db: Session,
    room_id: int
):

    room = (
        db.query(Room)
        .filter(
            Room.id == room_id
        )
        .first()
    )

    if room is None:

        return None

    tenant = (
        db.query(Tenant)
        .filter(
            Tenant.room_id == room.id
        )
        .first()
    )

    if tenant is not None:

        raise HTTPException(
            status_code=400,
            detail=(
                "This room has already been occupied. "
                "If you want to delete this room, "
                "you need to delete the tenant in this room first."
            )
        )

    try:

        db.delete(room)

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to delete room."
        )

    return {
        "message": "Room deleted successfully"
    }
