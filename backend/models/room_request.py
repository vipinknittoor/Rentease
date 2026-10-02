from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey
)
from sqlalchemy.sql import func

from database.db import Base


class RoomRequest(Base):

    __tablename__ = "room_requests"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    room_id = Column(
        Integer,
        ForeignKey("rooms.id"),
        nullable=False
    )

    status = Column(
        String,
        nullable=False,
        default="Pending"
    )

    requested_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    responded_at = Column(
        DateTime,
        nullable=True
    )