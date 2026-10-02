from pydantic import BaseModel, EmailStr, field_validator
from datetime import date
from typing import Optional
import re


def validate_full_name(value: str) -> str:
    value = value.strip()

    if not value:
        raise ValueError("Full name is required.")

    if len(value) < 2:
        raise ValueError("Full name must contain at least 2 characters.")

    if len(value) > 50:
        raise ValueError("Full name cannot exceed 50 characters.")

    if not re.fullmatch(r"[A-Za-z][A-Za-z .']*", value):
        raise ValueError(
            "Full name can contain only letters, spaces, dots and apostrophes."
        )

    return value


def validate_phone(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    value = value.strip()

    if not value:
        raise ValueError("Phone number is required.")

    value = value.replace(" ", "")

    if not re.fullmatch(r"[6-9]\d{9}", value):
        raise ValueError(
            "Phone number must be a valid 10-digit Indian mobile number."
        )

    return value


def validate_email(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    value = value.strip().lower()

    if not value:
        raise ValueError("Email address is required.")

    try:
        validated = EmailStr(value)
        return str(validated)
    except Exception:
        raise ValueError("Please enter a valid email address.")


class TenantCreate(BaseModel):

    user_id: Optional[int] = None

    full_name: str
    phone: str
    email: EmailStr

    room_number: str
    room_id: Optional[int] = None

    monthly_rent: float
    deposit: Optional[float] = None

    join_date: date
    status: Optional[str] = "Active"

    previous_reading: Optional[int] = 0
    current_reading: Optional[int] = 0

    electricity_units: Optional[int] = 0
    electricity_bill: Optional[float] = 0

    extra_bill: Optional[float] = 0

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value):
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def validate_phone_number(cls, value):
        return validate_phone(value)

    @field_validator("email")
    @classmethod
    def validate_email_address(cls, value):
        return str(value).strip().lower()

    @field_validator("room_number")
    @classmethod
    def validate_room_number(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Room selection is required.")

        return value

    @field_validator("monthly_rent")
    @classmethod
    def validate_rent(cls, value):
        if value < 0:
            raise ValueError("Monthly rent cannot be negative.")

        return value

    @field_validator("deposit")
    @classmethod
    def validate_deposit(cls, value):
        if value is not None and value < 0:
            raise ValueError("Deposit cannot be negative.")

        return value

    @field_validator("previous_reading", "current_reading")
    @classmethod
    def validate_meter_reading(cls, value):
        if value is not None and value < 0:
            raise ValueError("Meter reading cannot be negative.")

        return value

    @field_validator("extra_bill")
    @classmethod
    def validate_extra_bill(cls, value):
        if value is not None and value < 0:
            raise ValueError("Extra bill cannot be negative.")

        return value


class TenantUpdate(BaseModel):

    full_name: str
    phone: str
    email: EmailStr

    room_number: str
    room_id: Optional[int] = None

    join_date: date
    status: Optional[str] = "Active"

    previous_reading: Optional[int] = 0
    current_reading: Optional[int] = 0

    electricity_units: Optional[int] = 0
    electricity_bill: Optional[float] = 0

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value):
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def validate_phone_number(cls, value):
        return validate_phone(value)

    @field_validator("email")
    @classmethod
    def validate_email_address(cls, value):
        return str(value).strip().lower()

    @field_validator("room_number")
    @classmethod
    def validate_room_number(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Room selection is required.")

        return value

    @field_validator("previous_reading", "current_reading")
    @classmethod
    def validate_meter_reading(cls, value):
        if value is not None and value < 0:
            raise ValueError("Meter reading cannot be negative.")

        return value


class TenantResponse(BaseModel):

    id: int

    user_id: Optional[int] = None

    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None

    room_number: str
    room_id: Optional[int] = None

    monthly_rent: float
    deposit: Optional[float] = None

    join_date: Optional[date] = None
    status: Optional[str] = "Active"

    previous_reading: int
    current_reading: int

    electricity_units: int
    electricity_bill: float

    extra_bill: float = 0

    billing_ready: bool = False

    billing_enabled: bool = True

    class Config:
        from_attributes = True

