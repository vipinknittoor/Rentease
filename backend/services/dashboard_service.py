from sqlalchemy.orm import Session
from sqlalchemy import func

from models.room import Room
from models.tenant import Tenant
from models.payment import Payment

COMPLETED_PAYMENT_STATUSES = [
    "paid",
    "closed"
]


def get_dashboard_data(db: Session):

    total_rooms = (
        db.query(Room)
        .count()
    )


    occupied_rooms = (
        db.query(Room)
        .filter(
            Room.status == "Occupied"
        )
        .count()
    )

    vacant_rooms = (
        db.query(Room)
        .filter(
            Room.status == "Vacant"
        )
        .count()
    )


    active_tenants = (
        db.query(Tenant)
        .filter(
            Tenant.status == "Active",
            Tenant.room_id.isnot(None)
        )
        .count()
    )

    monthly_rent = (
        db.query(
            func.sum(Tenant.monthly_rent)
        )
        .filter(
            Tenant.status == "Active"
        )
        .scalar()
    )

    if monthly_rent is None:
        monthly_rent = 0

    return {
        "total_rooms": total_rooms,
        "occupied_rooms": occupied_rooms,
        "vacant_rooms": vacant_rooms,
        "active_tenants": active_tenants,
        "monthly_rent": float(monthly_rent)
    }


def get_payment_history(db: Session):

    payments = (
        db.query(
            Payment.id,
            Tenant.full_name,
            Room.room_number,
            Payment.billing_month,
            Payment.extra_bill,
            Payment.total_amount,
            Payment.status
        )
        .join(
            Tenant,
            Payment.tenant_id == Tenant.id
        )
        .join(
            Room,
            Tenant.room_id == Room.id
        )
        .order_by(
            Payment.billing_month.desc(),
            Payment.id.desc()
        )
        .all()
    )

    payment_list = []

    for payment in payments:

        payment_list.append(
            {
                

                "payment_id": payment.id,

                

                "tenant_name": payment.full_name,

               

                "room_number": payment.room_number,

                

                "billing_month": payment.billing_month,

        

                "extra_bill": float(
                    payment.extra_bill or 0
                ),

                

                "total_amount": float(
                    payment.total_amount or 0
                ),

                

                "status": payment.status
            }
        )

    return payment_list


def get_payment_summary(db: Session):


    completed_payments = (
        db.query(Payment)
        .filter(
            Payment.status.in_(
                COMPLETED_PAYMENT_STATUSES
            )
        )
        .all()
    )


    collected_amount = 0.0

    for payment in completed_payments:

        collected_amount += float(
            payment.total_amount or 0
        )


    paid_tenant_ids = set()

    for payment in completed_payments:

        if payment.tenant_id is not None:

            paid_tenant_ids.add(
                payment.tenant_id
            )

    paid_tenants = len(
        paid_tenant_ids
    )

    completed_payment_count = len(
        completed_payments
    )



    return {
        "collected": collected_amount,
        "paid_tenants": paid_tenants,
        "completed_payments": completed_payment_count
    }



def get_payment_summary_by_month(
    db: Session,
    billing_month
):

    completed_payments = (
        db.query(Payment)
        .filter(
            Payment.billing_month == billing_month,
            Payment.status.in_(
                COMPLETED_PAYMENT_STATUSES
            )
        )
        .all()
    )

    collected_amount = 0.0

    paid_tenant_ids = set()

    for payment in completed_payments:

        collected_amount += float(
            payment.total_amount or 0
        )

        if payment.tenant_id is not None:

            paid_tenant_ids.add(
                payment.tenant_id
            )

    return {
        "billing_month": billing_month,
        "collected": collected_amount,
        "paid_tenants": len(
            paid_tenant_ids
        ),
        "completed_payments": len(
            completed_payments
        )
    }