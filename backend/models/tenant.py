from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from database.db import Base


class Tenant(Base):

    __tablename__ = "tenants"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    full_name = Column(
        String,
        nullable=False
    )

    phone = Column(
        String
    )

    email = Column(
        String
    )

    room_number = Column(
        String,
        nullable=False
    )

    monthly_rent = Column(
        Numeric,
        nullable=False
    )

    
    previous_reading = Column(
        Integer,
        default=0
    )

    current_reading = Column(
        Integer,
        default=0
    )

  
    electricity_units = Column(
        Integer,
        default=0
    )

    electricity_bill = Column(
        Numeric,
        default=0
    )

    extra_bill = Column(
        Numeric,
        default=0,
        nullable=False
    )


    billing_ready = Column(
        Boolean,
        default=False,
        nullable=False
    )


    
    billing_enabled = Column(
    Boolean,
    default=True,
    nullable=False
   )


    deposit = Column(
        Numeric
    )

    join_date = Column(
        Date
    )

    status = Column(
        String,
        default="Active"
    )

    room_id = Column(
        Integer,
        ForeignKey("rooms.id"),
        nullable=True
    )

    room = relationship(
        "Room",
        back_populates="tenants"
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )