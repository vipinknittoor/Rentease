from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship

from database.db import Base


class Room(Base):

    __tablename__ = "rooms"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    room_number = Column(
        String(20),
        unique=True,
        nullable=False
    )

    floor = Column(
        Integer,
        nullable=False
    )

    room_type = Column(
        String(20),
        nullable=False,
        default="1 BHK"
    )

    capacity = Column(
        Integer,
        nullable=False,
        default=1
    )

    monthly_rent = Column(
        Float,
        nullable=False
    )

    status = Column(
        String(20),
        default="Vacant"
    )

    tenants = relationship(
        "Tenant",
        back_populates="room"
    )

