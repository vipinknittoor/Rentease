from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database.db import get_db
from models.tenant import Tenant

from schemas.tenant_schema import (
    TenantCreate,
    TenantResponse,
    TenantUpdate,
)

from services.tenant_service import (
    create_tenant,
    get_all_tenants,
    get_tenant_by_id,
    update_tenant,
    delete_tenant,
    update_electricity_units,
    update_extra_bill,
)

router = APIRouter(
    prefix="/tenants",
    tags=["Tenants"]
)


class ElectricityUpdate(BaseModel):
    previous_reading: int
    current_reading: int


class ExtraBillUpdate(BaseModel):
    extra_bill: float = Field(..., ge=0)


class BillingStatusUpdate(BaseModel):
    billing_enabled: bool


@router.post("/", response_model=TenantResponse)
def add_tenant(
    tenant: TenantCreate,
    db: Session = Depends(get_db)
):
    return create_tenant(db, tenant)


@router.get("/", response_model=list[TenantResponse])
def get_tenants(
    db: Session = Depends(get_db)
):
    return get_all_tenants(db)


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db)
):
    tenant = get_tenant_by_id(
        db,
        tenant_id
    )

    if tenant is None:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
def edit_tenant(
    tenant_id: int,
    tenant: TenantUpdate,
    db: Session = Depends(get_db)
):
    updated_tenant = update_tenant(
        db,
        tenant_id,
        tenant
    )

    if updated_tenant is None:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    return updated_tenant


@router.put("/{tenant_id}/electricity", response_model=TenantResponse)
def update_electricity(
    tenant_id: int,
    data: ElectricityUpdate,
    db: Session = Depends(get_db)
):
    tenant = update_electricity_units(
        db,
        tenant_id,
        data.previous_reading,
        data.current_reading
    )

    return tenant


@router.put("/{tenant_id}/extra-bill", response_model=TenantResponse)
def update_tenant_extra_bill(
    tenant_id: int,
    data: ExtraBillUpdate,
    db: Session = Depends(get_db)
):
    tenant = update_extra_bill(
        db,
        tenant_id,
        data.extra_bill
    )

    if tenant is None:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    return tenant


@router.put("/{tenant_id}/billing-status", response_model=TenantResponse)
def update_billing_status(
    tenant_id: int,
    data: BillingStatusUpdate,
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id
    ).first()

    if tenant is None:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    tenant.billing_enabled = data.billing_enabled

    db.commit()
    db.refresh(tenant)

    return tenant


@router.delete("/{tenant_id}")
def remove_tenant(
    tenant_id: int,
    db: Session = Depends(get_db)
):
    deleted = delete_tenant(
        db,
        tenant_id
    )

    if deleted is None:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    return {
        "message": "Tenant deleted successfully"
    }


@router.get("/profile/{user_id}", response_model=TenantResponse)
def get_tenant_profile(
    user_id: int,
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(
        Tenant.user_id == user_id
    ).first()

    if tenant is None:
        raise HTTPException(
            status_code=404,
            detail="Tenant profile not found"
        )

    return tenant

