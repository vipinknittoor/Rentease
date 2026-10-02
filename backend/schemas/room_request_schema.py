from datetime import datetime

from pydantic import BaseModel


class RoomRequestCreate(BaseModel):

    room_id: int


class RoomRequestResponse(BaseModel):

    id: int
    user_id: int
    room_id: int
    status: str
    requested_at: datetime
    responded_at: datetime | None = None

    class Config:
        from_attributes = True