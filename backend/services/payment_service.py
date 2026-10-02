import re
from datetime import datetime
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.payment import Payment
from models.tenant import Tenant
from services.email_service import send_payment_reminder_email


STATUS_PENDING = "Pending"
STATUS_PAID = "Paid"

STATUS_INFORMED = "informed"
STATUS_PARTIALLY_PAID = "partially_paid"
STATUS_PAYMENT_CLOSED = "payment_closed"


UNPAID_STATUSES = [
    STATUS_PENDING,
    STATUS_INFORMED,
    STATUS_PARTIALLY_PAID
]

CLOSED_STATUSES = [
    STATUS_PAID,
    STATUS_PAYMENT_CLOSED
]

TRANSITIONABLE_STATUSES = [
    STATUS_PENDING,
    STATUS_INFORMED
]

STATUS_CHANGE_ELIGIBLE_STATUSES = [
    STATUS_PENDING,
    STATUS_INFORMED,
    STATUS_PARTIALLY_PAID
]

MANUAL_STATUS_OPTIONS = [
    STATUS_PARTIALLY_PAID,
    STATUS_PAYMENT_CLOSED
]


UPI_ID_PATTERN = re.compile(
    r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$"
)


def _validate_upi_id(upi_id: str) -> str:
    trimmed = (upi_id or "").strip()

    if not UPI_ID_PATTERN.match(trimmed):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please enter a valid UPI ID, "
                "e.g. name@bank or 9876543210@ybl"
            )
        )

    return trimmed


def _resolve_upi_id(payment: Payment) -> str:
    upi_id = (payment.upi_id or "").strip()

    if not upi_id:
        raise HTTPException(
            status_code=400,
            detail="No UPI ID is configured for this bill."
        )

    return _validate_upi_id(upi_id)


def _format_status_label(status: str) -> str:
    return status.replace("_", " ").title()


def _sanitize_phone_for_whatsapp(phone: str) -> str:
    digits = re.sub(
        r"\D",
        "",
        phone or ""
    )

    if not digits:
        return ""

    if len(digits) == 10:
        digits = "91" + digits

    return digits


def _is_latest_unpaid_bill(
    db: Session,
    payment: Payment
) -> bool:

    latest_unpaid = (
        db.query(Payment)
        .filter(
            Payment.tenant_id == payment.tenant_id,
            Payment.status.in_(UNPAID_STATUSES)
        )
        .order_by(
            Payment.billing_month.desc()
        )
        .first()
    )

    return (
        latest_unpaid is not None
        and latest_unpaid.id == payment.id
    )


def _get_billing_readiness(
    db: Session
):

    tenants = (
        db.query(Tenant)
        .filter(
            Tenant.status == "Active",
            Tenant.room_id.isnot(None)
        )
        .all()
    )

    pending_tenants = [
        tenant.full_name
        for tenant in tenants
        if not tenant.billing_ready
    ]

    return {
        "ready": len(pending_tenants) == 0,
        "pending_tenants": pending_tenants
    }


def create_or_update_payment(
    db: Session,
    tenant_id: int
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
            detail="Tenant not found"
        )

    billing_month = tenant.join_date.strftime(
        "%Y-%m"
    )

    payment = (
        db.query(Payment)
        .filter(
            Payment.tenant_id == tenant_id,
            Payment.billing_month == billing_month
        )
        .first()
    )

    extra_bill = float(
        tenant.extra_bill or 0
    )

    current_amount = (
        float(tenant.monthly_rent or 0)
        +
        float(tenant.electricity_bill or 0)
        +
        extra_bill
    )

    if payment:

        if payment.status in UNPAID_STATUSES:

            payment.monthly_rent = float(
                tenant.monthly_rent or 0
            )

            payment.electricity_units = int(
                tenant.electricity_units or 0
            )

            payment.electricity_bill = float(
                tenant.electricity_bill or 0
            )

            payment.extra_bill = extra_bill

            payment.current_amount = current_amount

            payment.total_amount = (
                current_amount
                +
                float(payment.previous_due or 0)
            )

            payment.carry_forward_amount = (
                float(payment.previous_due or 0)
            )

    else:

        payment = Payment(
            tenant_id=tenant.id,
            billing_month=billing_month,
            monthly_rent=float(
                tenant.monthly_rent or 0
            ),
            electricity_units=int(
                tenant.electricity_units or 0
            ),
            electricity_bill=float(
                tenant.electricity_bill or 0
            ),
            extra_bill=extra_bill,
            previous_due=0,
            current_amount=current_amount,
            carry_forward_amount=0,
            total_amount=current_amount,
            status=STATUS_PENDING,
            upi_id=None
        )

        db.add(payment)

    db.commit()
    db.refresh(payment)

    return payment


def get_payment_history(
    db: Session,
    tenant_id: int
):

    return (
        db.query(Payment)
        .filter(
            Payment.tenant_id == tenant_id
        )
        .order_by(
            Payment.billing_month.desc()
        )
        .all()
    )


def get_latest_billing_month(
    db: Session
):

    readiness = _get_billing_readiness(db)

    latest_bill = (
        db.query(Payment)
        .order_by(
            Payment.billing_month.desc()
        )
        .first()
    )

    if latest_bill is None:

        current_month = datetime.now().replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0
        )

        starting_month = (
            current_month.strftime("%Y-%m")
        )

        return {
            "latest_billing_month": None,
            "next_billing_month": starting_month,
            "ready": readiness["ready"],
            "pending_tenants": readiness["pending_tenants"]
        }

    latest_month = datetime.strptime(
        latest_bill.billing_month,
        "%Y-%m"
    )

    if latest_month.month == 12:

        next_month = datetime(
            latest_month.year + 1,
            1,
            1
        )

    else:

        next_month = datetime(
            latest_month.year,
            latest_month.month + 1,
            1
        )

    next_billing_month = (
        next_month.strftime("%Y-%m")
    )

    return {
        "latest_billing_month": latest_bill.billing_month,
        "next_billing_month": next_billing_month,
        "ready": readiness["ready"],
        "pending_tenants": readiness["pending_tenants"]
    }


def generate_monthly_bills(
    db: Session,
    billing_month: str,
    upi_id: str
):

    validated_upi_id = _validate_upi_id(
        upi_id
    )

    try:

        datetime.strptime(
            billing_month,
            "%Y-%m"
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid billing month format. "
                "Use YYYY-MM."
            )
        )

    latest_bill = (
        db.query(Payment)
        .order_by(
            Payment.billing_month.desc()
        )
        .first()
    )

    if latest_bill is None:

        current_month = datetime.now().replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0
        )

        current_billing_month = (
            current_month.strftime("%Y-%m")
        )

        if billing_month != current_billing_month:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"The first billing month must be "
                    f"{current_billing_month}. "
                    f"Please generate that month first."
                )
            )

    existing_bills = (
        db.query(Payment)
        .filter(
            Payment.billing_month == billing_month
        )
        .count()
    )

    if existing_bills > 0:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Bills for {billing_month} "
                f"have already been generated."
            )
        )

    if latest_bill:

        latest_month = datetime.strptime(
            latest_bill.billing_month,
            "%Y-%m"
        )

        if latest_month.month == 12:

            expected_month = datetime(
                latest_month.year + 1,
                1,
                1
            )

        else:

            expected_month = datetime(
                latest_month.year,
                latest_month.month + 1,
                1
            )

        expected_billing_month = (
            expected_month.strftime("%Y-%m")
        )

        if billing_month != expected_billing_month:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot generate bills for "
                    f"{billing_month}. "
                    f"Please generate bills for "
                    f"{expected_billing_month} first."
                )
            )

    tenants = (
        db.query(Tenant)
        .filter(
            Tenant.status == "Active",
            Tenant.room_id.isnot(None),
            Tenant.billing_enabled.is_(True)
        )
        .all()
    )

    not_ready_tenants = [
        tenant.full_name
        for tenant in tenants
        if not tenant.billing_ready
    ]

    if not_ready_tenants:

        raise HTTPException(
            status_code=400,
            detail=(
                "Please update meter readings / extra bills "
                "and click Save All for the following tenant(s) "
                f"before generating bills for {billing_month}: "
                +
                ", ".join(not_ready_tenants)
            )
        )

    created = 0

    for tenant in tenants:

        monthly_rent = float(
            tenant.monthly_rent or 0
        )

        electricity_bill = float(
            tenant.electricity_bill or 0
        )

        electricity_units = int(
            tenant.electricity_units or 0
        )

        extra_bill = float(
            tenant.extra_bill or 0
        )

        current_month_amount = (
            monthly_rent
            +
            electricity_bill
            +
            extra_bill
        )

        previous_pending = (
            db.query(Payment)
            .filter(
                Payment.tenant_id == tenant.id,
                Payment.status.in_(UNPAID_STATUSES),
                Payment.billing_month < billing_month
            )
            .all()
        )

        previous_due = 0.0

        for payment in previous_pending:

            previous_due += float(
                payment.current_amount or 0
            )

        total_amount = (
            current_month_amount
            +
            previous_due
        )

        payment = Payment(
            tenant_id=tenant.id,
            billing_month=billing_month,
            monthly_rent=monthly_rent,
            electricity_units=electricity_units,
            electricity_bill=electricity_bill,
            extra_bill=extra_bill,
            previous_due=previous_due,
            current_amount=current_month_amount,
            carry_forward_amount=previous_due,
            total_amount=total_amount,
            status=STATUS_PENDING,
            upi_id=validated_upi_id
        )

        db.add(payment)

        created += 1

        tenant.billing_ready = False

    db.commit()

    return {
        "message": "Bills generated successfully.",
        "billing_month": billing_month,
        "created": created,
        "upi_id": validated_upi_id
    }


def edit_latest_pending_bill(
    db: Session,
    payment_id: int,
    new_amount: float
):

    if new_amount <= 0:

        raise HTTPException(
            status_code=400,
            detail="Amount must be greater than zero."
        )

    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )

    if payment is None:

        raise HTTPException(
            status_code=404,
            detail="Payment not found."
        )

    if payment.status in CLOSED_STATUSES:

        raise HTTPException(
            status_code=400,
            detail=(
                "This bill cannot be edited because it is "
                f"already "
                f"{_format_status_label(payment.status)}."
            )
        )

    latest_bill = (
        db.query(Payment)
        .order_by(
            Payment.billing_month.desc()
        )
        .first()
    )

    if latest_bill is None:

        raise HTTPException(
            status_code=400,
            detail="No generated billing month found."
        )

    if payment.billing_month != latest_bill.billing_month:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only bills from the latest generated "
                "billing month can be edited."
            )
        )

    previous_due = float(
        payment.previous_due or 0
    )

    new_current_amount = (
        float(new_amount)
        -
        previous_due
    )

    if new_current_amount < 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Amount cannot be less than the "
                f"previous due of ₹{previous_due:.2f}."
            )
        )

    payment.current_amount = new_current_amount

    payment.total_amount = (
        previous_due
        +
        new_current_amount
    )

    payment.carry_forward_amount = previous_due

    payment.paid_at = None

    db.commit()
    db.refresh(payment)

    return payment


def send_whatsapp_reminder(
    db: Session,
    payment_id: int
):

    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )

    if payment is None:

        raise HTTPException(
            status_code=404,
            detail="Payment not found."
        )

    if payment.status not in TRANSITIONABLE_STATUSES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot send a WhatsApp reminder for a bill "
                f"with status "
                f"'{_format_status_label(payment.status)}'."
            )
        )

    if not _is_latest_unpaid_bill(
        db,
        payment
    ):

        latest_unpaid = (
            db.query(Payment)
            .filter(
                Payment.tenant_id == payment.tenant_id,
                Payment.status.in_(UNPAID_STATUSES)
            )
            .order_by(
                Payment.billing_month.desc()
            )
            .first()
        )

        detail = (
            "Only the tenant's most recent pending bill "
            "can be reminded."
        )

        if latest_unpaid:

            detail += (
                f" Please use the bill for "
                f"{latest_unpaid.billing_month}."
            )

        raise HTTPException(
            status_code=400,
            detail=detail
        )

    total_amount = float(
        payment.total_amount or 0
    )

    if total_amount <= 0:

        raise HTTPException(
            status_code=400,
            detail="This tenant has no pending amount."
        )

    tenant = (
        db.query(Tenant)
        .filter(
            Tenant.id == payment.tenant_id
        )
        .first()
    )

    if tenant is None:

        raise HTTPException(
            status_code=404,
            detail="Tenant not found."
        )

    if not tenant.phone or not tenant.phone.strip():

        raise HTTPException(
            status_code=400,
            detail=(
                "This tenant does not have a registered "
                "phone number."
            )
        )

    whatsapp_number = _sanitize_phone_for_whatsapp(
        tenant.phone
    )

    if not whatsapp_number:

        raise HTTPException(
            status_code=400,
            detail="This tenant's phone number is invalid."
        )

    payment_upi_id = _resolve_upi_id(
        payment
    )

    message_text = (
        f"RentEase - Payment Reminder\n\n"
        f"Dear {tenant.full_name},\n\n"
        f"This is a reminder that your rent payment "
        f"is currently pending.\n\n"
        f"Payment Details\n"
        f"------------------------------\n"
        f"Amount Due: ₹{total_amount:,.2f}\n"
        f"Billing Month: {payment.billing_month}\n"
        f"Payment Status: Pending\n"
        f"------------------------------\n\n"
        f"Please complete your payment using the "
        f"UPI payment link below.\n\n"
        f"Payment Link:\n"
        f"upi://pay?"
        f"pa={payment_upi_id}"
        f"&pn=RentEase"
        f"&am={total_amount:.2f}"
        f"&cu=INR\n\n"
        f"Please verify the payment amount before "
        f"completing the transaction.\n\n"
        f"If you have already made this payment, "
        f"please disregard this reminder.\n\n"
        f"Thank you,\n"
        f"RentEase"
    )

    whatsapp_link = (
        f"https://wa.me/{whatsapp_number}"
        f"?text={quote(message_text)}"
    )

    payment.status = STATUS_INFORMED

    db.commit()
    db.refresh(payment)

    return {
        "success": True,
        "message": (
            "WhatsApp reminder generated and status "
            "updated to Informed."
        ),
        "whatsapp_link": whatsapp_link,
        "payment_id": payment.id,
        "tenant_id": tenant.id,
        "tenant_name": tenant.full_name,
        "status": payment.status,
        "upi_id": payment_upi_id
    }


def update_payment_status(
    db: Session,
    payment_id: int,
    new_status: str
):

    if new_status not in MANUAL_STATUS_OPTIONS:

        raise HTTPException(
            status_code=400,
            detail="Invalid status value."
        )

    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )

    if payment is None:

        raise HTTPException(
            status_code=404,
            detail="Payment not found."
        )

    if payment.status not in STATUS_CHANGE_ELIGIBLE_STATUSES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot change the status of a bill "
                f"that is "
                f"'{_format_status_label(payment.status)}'."
            )
        )

    if not _is_latest_unpaid_bill(
        db,
        payment
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Only the tenant's most recent pending bill "
                "can have its status updated."
            )
        )

    if new_status == STATUS_PAYMENT_CLOSED:

        previous_unpaid_payments = (
            db.query(Payment)
            .filter(
                Payment.tenant_id == payment.tenant_id,
                Payment.status.in_(UNPAID_STATUSES),
                Payment.billing_month <= payment.billing_month
            )
            .all()
        )

        closed_at = datetime.now()

        for previous_payment in previous_unpaid_payments:

            previous_payment.status = (
                STATUS_PAYMENT_CLOSED
            )

            previous_payment.paid_at = closed_at

    else:

        payment.status = new_status

    if new_status == STATUS_PAYMENT_CLOSED:

        payment.status = STATUS_PAYMENT_CLOSED
        payment.paid_at = datetime.now()

    db.commit()
    db.refresh(payment)

    return {
        "success": True,
        "message": (
            f"Status updated to "
            f"{_format_status_label(new_status)}."
        ),
        "payment_id": payment.id,
        "status": payment.status
    }


def get_pending_payments(
    db: Session,
    tenant_id: int
):

    return (
        db.query(Payment)
        .filter(
            Payment.tenant_id == tenant_id,
            Payment.status.in_(UNPAID_STATUSES)
        )
        .order_by(
            Payment.billing_month.asc()
        )
        .all()
    )


def get_total_pending_payment(
    db: Session,
    tenant_id: int
):

    pending_payments = (
        db.query(Payment)
        .filter(
            Payment.tenant_id == tenant_id,
            Payment.status.in_(UNPAID_STATUSES)
        )
        .order_by(
            Payment.billing_month.asc()
        )
        .all()
    )

    if not pending_payments:

        raise HTTPException(
            status_code=404,
            detail="No pending payments"
        )

    latest_pending = pending_payments[-1]

    return {
        "payments": pending_payments,
        "payment_ids": [
            payment.id
            for payment in pending_payments
        ],
        "total_amount": float(
            latest_pending.total_amount
        )
    }


def get_latest_pending_bill(
    db: Session,
    tenant_id: int
):

    latest_pending = (
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

    if latest_pending is None:

        return {
            "billing_month": None,
            "monthly_rent": 0,
            "electricity_bill": 0,
            "extra_bill": 0,
            "carry_forward_amount": 0,
            "total_amount": 0,
            "status": STATUS_PAID,
            "upi_id": None
        }

    return {
        "billing_month": latest_pending.billing_month,
        "monthly_rent": float(
            latest_pending.monthly_rent or 0
        ),
        "electricity_bill": float(
            latest_pending.electricity_bill or 0
        ),
        "extra_bill": float(
            latest_pending.extra_bill or 0
        ),
        "carry_forward_amount": float(
            latest_pending.carry_forward_amount or 0
        ),
        "total_amount": float(
            latest_pending.total_amount or 0
        ),
        "status": latest_pending.status,
        "upi_id": _resolve_upi_id(
            latest_pending
        )
    }


def delete_bills_by_month(
    db: Session,
    billing_month: str
):

    payments = (
        db.query(Payment)
        .filter(
            Payment.billing_month == billing_month
        )
        .all()
    )

    if not payments:

        raise HTTPException(
            status_code=404,
            detail="No bills found for this month."
        )

    deleted = len(payments)

    for payment in payments:
        db.delete(payment)

    db.commit()

    return {
        "message": f"{deleted} bills deleted successfully.",
        "billing_month": billing_month,
        "deleted": deleted
    }


def delete_all_bills(
    db: Session
):

    payments = (
        db.query(Payment)
        .all()
    )

    if not payments:

        return {
            "message": "No bills found.",
            "deleted": 0
        }

    deleted = len(payments)

    for payment in payments:
        db.delete(payment)

    db.commit()

    return {
        "message": "All bills deleted successfully.",
        "deleted": deleted
    }


def send_payment_reminders_to_all(
    db: Session
):

    tenants = (
        db.query(Tenant)
        .filter(
            Tenant.status == "Active"
        )
        .all()
    )

    if not tenants:

        return {
            "message": "No active tenants found.",
            "sent": 0,
            "failed": 0,
            "skipped": 0
        }

    sent = 0
    failed = 0
    skipped = 0

    failed_tenants = []
    skipped_tenants = []

    for tenant in tenants:

        if not tenant.email:

            skipped += 1

            skipped_tenants.append({
                "tenant_id": tenant.id,
                "tenant_name": tenant.full_name,
                "reason": "No email address"
            })

            continue

        latest_pending = (
            db.query(Payment)
            .filter(
                Payment.tenant_id == tenant.id,
                Payment.status.in_(UNPAID_STATUSES)
            )
            .order_by(
                Payment.billing_month.desc()
            )
            .first()
        )

        if latest_pending is None:

            skipped += 1

            skipped_tenants.append({
                "tenant_id": tenant.id,
                "tenant_name": tenant.full_name,
                "reason": "No pending bill"
            })

            continue

        total_amount = float(
            latest_pending.total_amount or 0
        )

        if total_amount <= 0:

            skipped += 1

            skipped_tenants.append({
                "tenant_id": tenant.id,
                "tenant_name": tenant.full_name,
                "reason": "No pending amount"
            })

            continue

        try:

            send_payment_reminder_email(
                recipient_email=tenant.email,
                tenant_name=tenant.full_name,
                billing_month=latest_pending.billing_month,
                monthly_rent=float(
                    latest_pending.monthly_rent or 0
                ),
                electricity_bill=float(
                    latest_pending.electricity_bill or 0
                ),
                extra_bill=float(
                    latest_pending.extra_bill or 0
                ),
                carry_forward_amount=float(
                    latest_pending.carry_forward_amount or 0
                ),
                total_amount=total_amount
            )

            sent += 1

        except Exception as error:

            failed += 1

            failed_tenants.append({
                "tenant_id": tenant.id,
                "tenant_name": tenant.full_name,
                "email": tenant.email,
                "error": str(error)
            })

    return {
        "message": "Payment reminders processed.",
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "failed_tenants": failed_tenants,
        "skipped_tenants": skipped_tenants
    }