from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.db import get_db

from schemas.dashboard_schema import (
    DashboardResponse,
    PaymentHistoryListResponse
)

from services.dashboard_service import (
    get_dashboard_data,
    get_payment_history
)


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

@router.get(
    "/",
    response_model=DashboardResponse
)
def read_dashboard(
    db: Session = Depends(get_db)
):
    return get_dashboard_data(db)



@router.get(
    "/payment-history",
    response_model=PaymentHistoryListResponse
)
def payment_history(
    db: Session = Depends(get_db)
):
    return {
        "payments": get_payment_history(db)
    }