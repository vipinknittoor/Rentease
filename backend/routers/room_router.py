from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.db import get_db

from schemas.room_schema import RoomCreate

from services.room_service import (
    create_room,
    get_rooms,
    get_room,
    update_room,
    delete_room
)

from dependencies.auth import get_current_owner

router = APIRouter(
    prefix="/rooms",
    tags=["Rooms"]
)

@router.post("/")
def add_room(
    room: RoomCreate,
    db: Session = Depends(get_db),
    current_owner=Depends(get_current_owner)
):

    return create_room(
        db,
        room
    )

@router.get("/")
def read_rooms(
    db: Session = Depends(get_db),
    current_owner=Depends(get_current_owner)
):

    return get_rooms(db)


@router.get("/{room_id}")
def read_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_owner=Depends(get_current_owner)
):

    return get_room(
        db,
        room_id
    )


@router.put("/{room_id}")
def edit_room(
    room_id: int,
    room: RoomCreate,
    db: Session = Depends(get_db),
    current_owner=Depends(get_current_owner)
):

    return update_room(
        db,
        room_id,
        room
    )


@router.delete("/{room_id}")
def remove_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_owner=Depends(get_current_owner)
):

    return delete_room(
        db,
        room_id
    )