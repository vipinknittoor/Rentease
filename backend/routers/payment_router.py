from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db

from schemas.payment_schema import (
    PaymentCreate,
    PaymentResponse,
    GenerateBillsRequest,
    PaymentAmountUpdate,
    PaymentStatusUpdate,
    WhatsAppReminderResponse,
    PaymentStatusUpdateResponse
)

from services.payment_service import (
    create_or_update_payment,
    get_payment_history,
    generate_monthly_bills,
    delete_bills_by_month,
    delete_all_bills,
    get_latest_pending_bill,
    get_latest_billing_month,
    edit_latest_pending_bill,
    send_payment_reminders_to_all,
    send_whatsapp_reminder,
    update_payment_status,
    UNPAID_STATUSES
)

from services.email_service import (
    send_payment_reminder_email
)

from models.payment import Payment
from models.tenant import Tenant


router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)


@router.post(
    "/",
    response_model=PaymentResponse
)
def create_payment(
    payment: PaymentCreate,
    db: Session = Depends(get_db)
):

    return create_or_update_payment(
        db,
        payment.tenant_id
    )


@router.delete("/delete-all")
def delete_all(
    db: Session = Depends(get_db)
):

    return delete_all_bills(db)


@router.post("/send-reminders-all")
def send_reminders_to_all(
    db: Session = Depends(get_db)
):

    return send_payment_reminders_to_all(db)


@router.get("/latest-billing-month")
def latest_billing_month(
    db: Session = Depends(get_db)
):

    return get_latest_billing_month(db)


@router.get("/latest-pending/{tenant_id}")
def latest_pending_bill(
    tenant_id: int,
    db: Session = Depends(get_db)
):

    return get_latest_pending_bill(
        db,
        tenant_id
    )


@router.post("/send-reminder/{tenant_id}")
def send_payment_reminder(
    tenant_id: int,
    db: Session = Depends(get_db)
):

    tenant = (
        db.query(Tenant)
        .filter(
            Tenant.id == tenant_id
        )
        .first()
    )

    if tenant is None:

        raise HTTPException(
            status_code=404,
            detail="Tenant not found."
        )

    if not tenant.email or not tenant.email.strip():

        raise HTTPException(
            status_code=400,
            detail=(
                "This tenant does not have a "
                "registered email address."
            )
        )

    pending_bill = (
        db.query(Payment)
        .filter(
            Payment.tenant_id == tenant_id,
            Payment.status.in_(UNPAID_STATUSES)
        )
        .order_by(
            Payment.billing_month.desc()
        )
        .first()
    )

    if pending_bill is None:

        raise HTTPException(
            status_code=400,
            detail="This tenant has no pending bills."
        )

    total_amount = float(
        pending_bill.total_amount or 0
    )

    if total_amount <= 0:

        raise HTTPException(
            status_code=400,
            detail="This tenant has no pending amount."
        )

    extra_bill = float(
        pending_bill.extra_bill or 0
    )

    send_payment_reminder_email(
        recipient_email=tenant.email,
        tenant_name=tenant.full_name,
        billing_month=pending_bill.billing_month,
        monthly_rent=float(
            pending_bill.monthly_rent or 0
        ),
        electricity_bill=float(
            pending_bill.electricity_bill or 0
        ),
        extra_bill=extra_bill,
        carry_forward_amount=float(
            pending_bill.carry_forward_amount or 0
        ),
        total_amount=total_amount
    )

    return {
        "success": True,
        "message": (
            "Payment reminder email sent successfully."
        ),
        "tenant_id": tenant.id,
        "tenant_name": tenant.full_name,
        "email": tenant.email,
        "billing_month": pending_bill.billing_month,
        "extra_bill": extra_bill,
        "total_amount": total_amount
    }


@router.post(
    "/whatsapp-reminder/{payment_id}",
    response_model=WhatsAppReminderResponse
)
def whatsapp_reminder(
    payment_id: int,
    db: Session = Depends(get_db)
):

    return send_whatsapp_reminder(
        db,
        payment_id
    )


@router.put(
    "/status/{payment_id}",
    response_model=PaymentStatusUpdateResponse
)
def change_payment_status(
    payment_id: int,
    payload: PaymentStatusUpdate,
    db: Session = Depends(get_db)
):

    return update_payment_status(
        db,
        payment_id,
        payload.status
    )


@router.put(
    "/edit/{payment_id}",
    response_model=PaymentResponse
)
def edit_payment(
    payment_id: int,
    payment_data: PaymentAmountUpdate,
    db: Session = Depends(get_db)
):

    return edit_latest_pending_bill(
        db,
        payment_id,
        payment_data.amount
    )


@router.post("/generate-monthly-bills")
def generate_bills(
    request: GenerateBillsRequest,
    db: Session = Depends(get_db)
):

    return generate_monthly_bills(
        db,
        request.billing_month,
        request.upi_id
    )


@router.delete("/delete/{payment_id}")
def delete_individual_bill(
    payment_id: int,
    db: Session = Depends(get_db)
):

    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )

    if payment is None:

        return {
            "message": "Payment not found.",
            "deleted": False
        }

    billing_month = payment.billing_month
    tenant_id = payment.tenant_id

    db.delete(payment)

    db.commit()

    return {
        "message": "Bill deleted successfully.",
        "deleted": True,
        "payment_id": payment_id,
        "tenant_id": tenant_id,
        "billing_month": billing_month
    }


@router.delete("/delete-bills/{billing_month}")
def delete_bills(
    billing_month: str,
    db: Session = Depends(get_db)
):

    return delete_bills_by_month(
        db,
        billing_month
    )


@router.get(
    "/{tenant_id}",
    response_model=list[PaymentResponse]
)
def payment_history(
    tenant_id: int,
    db: Session = Depends(get_db)
):

    return get_payment_history(
        db,
        tenant_id
    )