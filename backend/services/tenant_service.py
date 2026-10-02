from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.tenant import Tenant
from models.room import Room
from models.payment import Payment

from schemas.tenant_schema import (
    TenantCreate,
    TenantUpdate,
)



ELECTRICITY_RATE = 7


UNPAID_STATUSES = [
    "Pending",
    "informed",
    "partially_paid",
]


CLOSED_STATUSES = [
    "Paid",
    "payment_closed",
]



def create_tenant(
    db: Session,
    tenant: TenantCreate
):

  
    room = (
        db.query(Room)
        .filter(
            Room.id == tenant.room_id
        )
        .first()
    )

    if room is None:

        raise HTTPException(
            status_code=404,
            detail="Selected room not found."
        )

    if room.status != "Vacant":

        raise HTTPException(
            status_code=400,
            detail=(
                f"Room {room.room_number} is already occupied."
            )
        )


    new_tenant = Tenant(


        user_id=tenant.user_id,

        full_name=tenant.full_name,
        phone=tenant.phone,
        email=tenant.email,

        room_number=tenant.room_number,
        room_id=tenant.room_id,


        monthly_rent=tenant.monthly_rent,
        deposit=tenant.deposit,


        join_date=tenant.join_date,
        status=tenant.status or "Active",

     

        previous_reading=tenant.previous_reading or 0,
        current_reading=tenant.current_reading or 0,

        electricity_units=(
            tenant.electricity_units or 0
        ),

        electricity_bill=(
            tenant.electricity_bill or 0
        ),


        extra_bill=tenant.extra_bill or 0,



        billing_ready=False,
    )



    db.add(new_tenant)

    

    room.status = "Occupied"


    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to create tenant and assign room."
        )



    db.refresh(new_tenant)

    return new_tenant




def get_all_tenants(
    db: Session
):

    return (
        db.query(Tenant)
        .order_by(Tenant.id.asc())
        .all()
    )



def get_tenant_by_id(
    db: Session,
    tenant_id: int
):

    return (
        db.query(Tenant)
        .filter(
            Tenant.id == tenant_id
        )
        .first()
    )


def update_tenant(
    db: Session,
    tenant_id: int,
    tenant: TenantUpdate
):

   

    existing_tenant = (
        db.query(Tenant)
        .filter(
            Tenant.id == tenant_id
        )
        .first()
    )

    if existing_tenant is None:
        return None

  

    old_room_id = existing_tenant.room_id



    new_room = (
        db.query(Room)
        .filter(
            Room.id == tenant.room_id
        )
        .first()
    )

    if new_room is None:

        raise HTTPException(
            status_code=404,
            detail="Selected room not found."
        )



    room_changed = (
        old_room_id != tenant.room_id
    )

   

    if room_changed:

     

        if new_room.status != "Vacant":

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Room {new_room.room_number} "
                    "is already occupied."
                )
            )


    existing_tenant.full_name = (
        tenant.full_name
    )

    existing_tenant.phone = (
        tenant.phone
    )

    existing_tenant.email = (
        tenant.email
    )

   

    existing_tenant.room_id = (
        new_room.id
    )

    existing_tenant.room_number = (
        new_room.room_number
    )

  

    existing_tenant.monthly_rent = (
        new_room.monthly_rent
    )

  
    existing_tenant.join_date = (
        tenant.join_date
    )

    existing_tenant.status = (
        tenant.status or "Active"
    )


    if room_changed:

     

        if old_room_id is not None:

            old_room = (
                db.query(Room)
                .filter(
                    Room.id == old_room_id
                )
                .first()
            )

            if old_room is not None:

                old_room.status = "Vacant"


        new_room.status = "Occupied"

    else:


        new_room.status = "Occupied"

 

    pending_payment = (
        db.query(Payment)
        .filter(
            Payment.tenant_id == existing_tenant.id,
            Payment.status == "Pending"
        )
        .first()
    )

    if pending_payment:


        pending_payment.monthly_rent = (
            new_room.monthly_rent
        )


        pending_payment.total_amount = (
            float(new_room.monthly_rent)
            +
            float(existing_tenant.electricity_bill or 0)
            +
            float(existing_tenant.extra_bill or 0)
        )

  

    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to update tenant and room."
        )

    

    db.refresh(existing_tenant)

    return existing_tenant



def update_electricity_units(
    db: Session,
    tenant_id: int,
    previous_reading: int,
    current_reading: int
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


    if current_reading < previous_reading:

        raise HTTPException(
            status_code=400,
            detail=(
                "Current reading cannot be "
                "less than previous reading."
            )
        )


    units = (
        current_reading -
        previous_reading
    )

  

    electricity_bill = (
        units *
        ELECTRICITY_RATE
    )

  

    tenant.previous_reading = (
        previous_reading
    )

    tenant.current_reading = (
        current_reading
    )

    tenant.electricity_units = (
        units
    )

    tenant.electricity_bill = (
        electricity_bill
    )


    tenant.billing_ready = True

  

    db.commit()

    db.refresh(tenant)

    return tenant



def update_extra_bill(
    db: Session,
    tenant_id: int,
    extra_bill: float
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

  

    if extra_bill < 0:

        raise HTTPException(
            status_code=400,
            detail="Extra bill cannot be negative."
        )

  

    tenant.extra_bill = extra_bill


    db.commit()

    db.refresh(tenant)

    return tenant




def delete_tenant(
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
        return None

  

    payments = (
        db.query(Payment)
        .filter(
            Payment.tenant_id == tenant_id
        )
        .all()
    )

   

    unpaid_payments = [
        payment
        for payment in payments
        if payment.status in UNPAID_STATUSES
    ]

    

    if unpaid_payments:

        latest_unpaid = sorted(
            unpaid_payments,
            key=lambda payment: payment.billing_month,
            reverse=True
        )[0]

        raise HTTPException(
            status_code=400,
            detail=(
                "This tenant cannot be deleted because "
                f"there is still an unpaid bill for "
                f"{latest_unpaid.billing_month}. "
                "Please close or pay the latest pending "
                "bill before deleting the tenant."
            )
        )


    room = (
        db.query(Room)
        .filter(
            Room.id == tenant.room_id
        )
        .first()
    )

    if room is not None:

        room.status = "Vacant"

   

    for payment in payments:

        db.delete(payment)


    db.delete(tenant)

   

    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to delete tenant."
        )


    return True