from pydantic import BaseModel
from typing import List


class DashboardResponse(BaseModel):

    total_rooms: int
    occupied_rooms: int
    vacant_rooms: int
    active_tenants: int
    monthly_rent: float


class PaymentHistoryResponse(BaseModel):

    payment_id: int
    tenant_name: str
    room_number: str
    billing_month: str
    extra_bill: float = 0
    total_amount: float
    status: str



class PaymentHistoryListResponse(BaseModel):

    payments: List[PaymentHistoryResponse]