from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    tenant_id: int


class GenerateBillsRequest(BaseModel):
    billing_month: str
    upi_id: str


class PaymentAmountUpdate(BaseModel):
    amount: float = Field(
        ...,
        gt=0,
        description="New total amount for the bill"
    )


class PaymentStatusUpdate(BaseModel):
    status: Literal[
        "partially_paid",
        "payment_closed"
    ] = Field(
        ...,
        description=(
            "New status for this bill. Allowed values: "
            "partially_paid, payment_closed."
        )
    )


class WhatsAppReminderResponse(BaseModel):
    success: bool
    message: str

    whatsapp_link: str

    payment_id: int
    tenant_id: int
    tenant_name: str

    status: str

    upi_id: str | None = None


class PaymentStatusUpdateResponse(BaseModel):
    success: bool
    message: str

    payment_id: int
    status: str


class PaymentResponse(BaseModel):
    id: int
    tenant_id: int
    billing_month: str

    monthly_rent: float
    electricity_units: int
    electricity_bill: float

    extra_bill: float = 0

    previous_due: float
    current_amount: float
    carry_forward_amount: float
    total_amount: float

    status: str

    paid_at: datetime | None = None
    created_at: datetime | None = None

    upi_id: str | None = None

    class Config:
        from_attributes = True