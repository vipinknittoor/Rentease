from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.db import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id"),
        nullable=False
    )

    billing_month = Column(
        String,
        nullable=False
    )

   
    monthly_rent = Column(
        Float,
        nullable=False
    )

    
    electricity_units = Column(
        Integer,
        default=0,
        nullable=False
    )

    electricity_bill = Column(
        Float,
        default=0,
        nullable=False
    )

  
    extra_bill = Column(
        Float,
        default=0,
        nullable=False
    )

    previous_due = Column(
        Float,
        default=0,
        nullable=False
    )

    current_amount = Column(
        Float,
        nullable=False
    )

    
    total_amount = Column(
        Float,
        nullable=False
    )

    status = Column(
        String,
        default="Pending",
        nullable=False
    )

    paid_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    tenant = relationship("Tenant")

    carry_forward_amount = Column(
        Float,
        nullable=False,
        default=0
    )


    upi_id = Column(
        String,
        nullable=True
    )