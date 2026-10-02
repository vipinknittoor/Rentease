from pydantic import BaseModel


class RoomCreate(BaseModel):
    room_number: str
    floor: int
    room_type: str
    capacity: int
    monthly_rent: float


class RoomResponse(BaseModel):
    id: int
    room_number: str
    floor: int
    room_type: str
    capacity: int
    monthly_rent: float
    status: str

    class Config:
        from_attributes = True

