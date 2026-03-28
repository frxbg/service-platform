from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db

router = APIRouter()


@router.get("/", response_model=List[schemas.service_request.Warehouse])
def read_warehouses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.WAREHOUSES_MANAGE.value,
            PermissionCode.MATERIAL_USAGES_MANAGE.value,
            require_all=False,
        )
    ),
) -> Any:
    return db.query(models.Warehouse).order_by(models.Warehouse.code.asc()).all()


@router.post("/", response_model=schemas.service_request.Warehouse)
def create_warehouse(
    *,
    db: Session = Depends(get_db),
    warehouse_in: schemas.service_request.WarehouseCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.WAREHOUSES_MANAGE.value)),
) -> Any:
    existing = db.query(models.Warehouse).filter(
        (models.Warehouse.code == warehouse_in.code) | (models.Warehouse.name == warehouse_in.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Warehouse code or name already exists")

    warehouse = models.Warehouse(**warehouse_in.model_dump())
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return warehouse


@router.patch("/{warehouse_id}", response_model=schemas.service_request.Warehouse)
def update_warehouse(
    *,
    db: Session = Depends(get_db),
    warehouse_id: UUID,
    warehouse_in: schemas.service_request.WarehouseUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.WAREHOUSES_MANAGE.value)),
) -> Any:
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    for field, value in warehouse_in.model_dump(exclude_unset=True).items():
        setattr(warehouse, field, value)

    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return warehouse
