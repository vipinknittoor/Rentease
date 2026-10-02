from typing import Literal
import re

from pydantic import (
    BaseModel,
    EmailStr,
    field_validator
)


class CaptchaResponse(BaseModel):

    captcha_id: str
    question: str


class UserCreate(BaseModel):

    full_name: str
    email: EmailStr
    phone: str
    password: str
    role: Literal["tenant", "owner"]

   
    captcha_id: str
    captcha_answer: str

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value):

        value = value.strip()

        if len(value) < 3:
            raise ValueError(
                "Name must contain at least 3 characters"
            )

        if not value.replace(" ", "").isalpha():
            raise ValueError(
                "Name should contain only alphabets"
            )

        return value


    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):

        if not re.fullmatch(
            r"[0-9]{10}",
            value
        ):
            raise ValueError(
                "Phone number must be exactly 10 digits"
            )

        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):

        if len(value) > 64:
            raise ValueError(
                "Password cannot exceed 64 characters"
            )

        password_rule = (
            r"^(?=.*[a-z])"
            r"(?=.*[A-Z])"
            r"(?=.*\d)"
            r"(?=.*[@#$%^&*])"
            r".{8,}$"
        )

        if not re.fullmatch(
            password_rule,
            value
        ):
            raise ValueError(
                "Password must contain at least 8 characters, "
                "one uppercase letter, one lowercase letter, "
                "one number and one special character"
            )

        return value


    @field_validator("captcha_id")
    @classmethod
    def validate_captcha_id(cls, value):

        value = value.strip()

        if not value:
            raise ValueError(
                "CAPTCHA verification is required"
            )

        return value

    @field_validator("captcha_answer")
    @classmethod
    def validate_captcha_answer(cls, value):

        value = value.strip()

        if not value:
            raise ValueError(
                "CAPTCHA answer is required"
            )

        return value


class UserLogin(BaseModel):

    email: EmailStr
    password: str

    captcha_id: str
    captcha_answer: str

  

    @field_validator("captcha_id")
    @classmethod
    def validate_captcha_id(cls, value):

        value = value.strip()

        if not value:
            raise ValueError(
                "CAPTCHA verification is required"
            )

        return value

    @field_validator("captcha_answer")
    @classmethod
    def validate_captcha_answer(cls, value):

        value = value.strip()

        if not value:
            raise ValueError(
                "CAPTCHA answer is required"
            )

        return value


class ForgotPasswordRequest(BaseModel):

    email: EmailStr



class ResetPasswordRequest(BaseModel):

    token: str
    new_password: str

  

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value):

        if len(value) > 64:
            raise ValueError(
                "Password cannot exceed 64 characters"
            )

        password_rule = (
            r"^(?=.*[a-z])"
            r"(?=.*[A-Z])"
            r"(?=.*\d)"
            r"(?=.*[^A-Za-z0-9])"
            r".{8,}$"
        )

        if not re.fullmatch(
            password_rule,
            value
        ):
            raise ValueError(
                "Password must contain at least 8 characters, "
                "one uppercase letter, one lowercase letter, "
                "one number and one special character"
            )

        return value


class UserResponse(BaseModel):

    id: int
    full_name: str
    email: EmailStr
    phone: str
    role: str

    class Config:
        from_attributes = True