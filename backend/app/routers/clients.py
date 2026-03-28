from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session, selectinload
import json

from app import models, schemas
from app.core.data_visibility import (
    can_read_billing_projects_commercial,
    can_read_billing_projects_operational,
)
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db
from app.utils.import_utils import parse_selected_row_indexes, read_tabular_upload

router = APIRouter()
ALLOWED_IMPORT_MODES = {"upsert", "skip", "rename", "error"}


def _prefix_import_value(value: Optional[str], fallback: str = "record") -> str:
    clean_value = (value or "").strip() or fallback
    if clean_value.lower().startswith("import_"):
        return clean_value
    return f"import_{clean_value}"


def _build_unique_client_name(db: Session, base_value: str) -> str:
    normalized = _prefix_import_value(base_value, fallback="client")
    candidate = normalized
    counter = 1

    while db.query(models.Client).filter(models.Client.name.ilike(candidate)).first():
        counter += 1
        candidate = f"import_{counter}_{base_value}"

    return candidate


def _build_unique_client_number(db: Session, base_value: str) -> str:
    normalized = _prefix_import_value(base_value, fallback="client")
    candidate = normalized
    counter = 1

    while db.query(models.Client).filter(models.Client.client_number == candidate).first():
        counter += 1
        candidate = f"import_{counter}_{base_value}"

    return candidate


def _build_unique_site_code(db: Session, client_id: str, base_value: str) -> str:
    normalized = _prefix_import_value(base_value, fallback="site")
    candidate = normalized
    counter = 1

    while (
        db.query(models.ClientSite)
        .filter(
            models.ClientSite.client_id == client_id,
            models.ClientSite.site_code == candidate,
        )
        .first()
    ):
        counter += 1
        candidate = f"import_{counter}_{base_value}"

    return candidate


def _normalize_billing_project_defaults(
    db: Session,
    *,
    client_id: str,
    site_id: str | None,
    current_project_id: str | None = None,
) -> None:
    projects = (
        db.query(models.ClientBillingProject)
        .filter(
            models.ClientBillingProject.client_id == client_id,
            models.ClientBillingProject.site_id == site_id,
        )
        .all()
    )
    has_default = False
    active_projects = [project for project in projects if project.is_active]
    for project in projects:
        if current_project_id and str(project.id) == str(current_project_id):
            has_default = has_default or project.is_default
            continue
        if project.is_default:
            project.is_default = False
            db.add(project)
    if not has_default and active_projects and not current_project_id:
        active_projects[0].is_default = True
        db.add(active_projects[0])


def _validate_billing_project_scope(
    db: Session,
    *,
    client_id: str,
    site_id: str | None,
) -> None:
    if not site_id:
        return
    site = (
        db.query(models.ClientSite)
        .filter(models.ClientSite.id == site_id, models.ClientSite.client_id == client_id)
        .first()
    )
    if not site:
        raise HTTPException(status_code=400, detail="Billing project site does not belong to client")


def _serialize_client_billing_project(
    billing_project: models.ClientBillingProject,
    *,
    include_commercial: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": billing_project.id,
        "client_id": billing_project.client_id,
        "site_id": billing_project.site_id,
        "project_reference": billing_project.project_reference,
        "project_year": billing_project.project_year,
        "service_type": billing_project.service_type.value if billing_project.service_type else None,
        "payment_mode": billing_project.payment_mode.value if billing_project.payment_mode else None,
        "description": billing_project.description,
        "valid_from": billing_project.valid_from,
        "valid_to": billing_project.valid_to,
        "is_default": billing_project.is_default,
        "is_active": billing_project.is_active,
        "notes": billing_project.notes,
        "created_at": billing_project.created_at,
        "updated_at": billing_project.updated_at,
    }
    if include_commercial:
        payload.update(
            {
                "regular_labor_rate": billing_project.regular_labor_rate,
                "transport_rate": billing_project.transport_rate,
            }
        )
    return payload


def _serialize_client(
    client: models.Client,
    *,
    include_billing_projects: bool,
    include_billing_commercial: bool,
) -> dict[str, Any]:
    return {
        "id": client.id,
        "name": client.name,
        "client_number": client.client_number,
        "project_number": client.project_number,
        "salutation_name": client.salutation_name,
        "vat_number": client.vat_number,
        "address": client.address,
        "city": client.city,
        "country": client.country,
        "email": client.email,
        "phone": client.phone,
        "notes": client.notes,
        "created_at": client.created_at,
        "updated_at": client.updated_at,
        "sites": [schemas.client.ClientSite.model_validate(site).model_dump() for site in client.sites],
        "contacts": [schemas.client.ClientContact.model_validate(contact).model_dump() for contact in client.contacts],
        "billing_projects": [
            _serialize_client_billing_project(project, include_commercial=include_billing_commercial)
            for project in client.billing_projects
        ]
        if include_billing_projects
        else [],
    }

@router.get("/", response_model=List[schemas.client.Client])
def read_clients(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.CLIENTS_READ.value,
            PermissionCode.CLIENTS_MANAGE.value,
            require_all=False,
        )
    ),
) -> Any:
    query = db.query(models.Client).options(
        selectinload(models.Client.sites),
        selectinload(models.Client.contacts),
        selectinload(models.Client.billing_projects),
    )
    if search:
        query = query.filter(models.Client.name.ilike(f"%{search}%"))
    clients = query.offset(skip).limit(limit).all()
    include_billing_projects = can_read_billing_projects_operational(db, current_user)
    include_billing_commercial = can_read_billing_projects_commercial(db, current_user)
    return [
        _serialize_client(
            client,
            include_billing_projects=include_billing_projects,
            include_billing_commercial=include_billing_commercial,
        )
        for client in clients
    ]

@router.post("/", response_model=schemas.client.Client)
def create_client(
    *,
    db: Session = Depends(get_db),
    client_in: schemas.client.ClientCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    if client_in.client_number:
        existing_number = (
            db.query(models.Client)
            .filter(models.Client.client_number == client_in.client_number)
            .first()
        )
        if existing_number:
            raise HTTPException(status_code=400, detail="Client with this number already exists")

    client = models.Client(**client_in.dict())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client

@router.get("/{client_id}", response_model=schemas.client.Client)
def read_client(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    current_user: models.User = Depends(
        require_permissions(
            PermissionCode.CLIENTS_READ.value,
            PermissionCode.CLIENTS_MANAGE.value,
            require_all=False,
        )
    ),
) -> Any:
    client = (
        db.query(models.Client)
        .options(
            selectinload(models.Client.sites),
            selectinload(models.Client.contacts),
            selectinload(models.Client.billing_projects),
        )
        .filter(models.Client.id == client_id)
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return _serialize_client(
        client,
        include_billing_projects=can_read_billing_projects_operational(db, current_user),
        include_billing_commercial=can_read_billing_projects_commercial(db, current_user),
    )

@router.patch("/{client_id}", response_model=schemas.client.Client)
def update_client(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    client_in: schemas.client.ClientUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if client_in.client_number:
        existing_number = (
            db.query(models.Client)
            .filter(models.Client.client_number == client_in.client_number, models.Client.id != client_id)
            .first()
        )
        if existing_number:
            raise HTTPException(status_code=400, detail="Client with this number already exists")
    
    update_data = client_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
        
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.post("/{client_id}/contacts", response_model=schemas.client.ClientContact)
def create_client_contact(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    contact_in: schemas.client.ClientContactCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if str(contact_in.client_id) != str(client_id):
        raise HTTPException(status_code=400, detail="Client ID mismatch for contact")

    contact = models.ClientContact(
        client_id=client_id,
        name=contact_in.name,
        email=contact_in.email,
        phone=contact_in.phone,
        role=contact_in.role,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.post("/{client_id}/sites", response_model=schemas.client.ClientSite)
def create_client_site(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    site_in: schemas.client.ClientSiteCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if str(site_in.client_id) != str(client_id):
        raise HTTPException(status_code=400, detail="Client ID mismatch for site")

    existing = (
        db.query(models.ClientSite)
        .filter(
            models.ClientSite.client_id == client.id,
            models.ClientSite.site_code == site_in.site_code,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Site code already exists for this client")

    site = models.ClientSite(
        client_id=client.id,
        site_code=site_in.site_code,
        site_name=site_in.site_name,
        city=site_in.city,
        address=site_in.address,
        project_number=site_in.project_number,
        notes=site_in.notes,
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.post("/{client_id}/billing-projects", response_model=schemas.client.ClientBillingProject)
def create_client_billing_project(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    billing_project_in: schemas.client.ClientBillingProjectCreate,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if str(billing_project_in.client_id) != str(client_id):
        raise HTTPException(status_code=400, detail="Client ID mismatch for billing project")
    _validate_billing_project_scope(db, client_id=client_id, site_id=str(billing_project_in.site_id) if billing_project_in.site_id else None)

    billing_project = models.ClientBillingProject(**billing_project_in.model_dump())
    if billing_project.is_default:
        _normalize_billing_project_defaults(
            db,
            client_id=client_id,
            site_id=str(billing_project.site_id) if billing_project.site_id else None,
        )
    db.add(billing_project)
    db.commit()
    db.refresh(billing_project)
    return _serialize_client_billing_project(billing_project, include_commercial=True)


@router.patch("/{client_id}/billing-projects/{billing_project_id}", response_model=schemas.client.ClientBillingProject)
def update_client_billing_project(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    billing_project_id: str,
    billing_project_in: schemas.client.ClientBillingProjectUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    billing_project = (
        db.query(models.ClientBillingProject)
        .filter(
            models.ClientBillingProject.id == billing_project_id,
            models.ClientBillingProject.client_id == client_id,
        )
        .first()
    )
    if not billing_project:
        raise HTTPException(status_code=404, detail="Billing project not found")

    update_data = billing_project_in.model_dump(exclude_unset=True)
    next_site_id = update_data.get("site_id", billing_project.site_id)
    _validate_billing_project_scope(db, client_id=client_id, site_id=str(next_site_id) if next_site_id else None)

    if update_data.get("is_default"):
        _normalize_billing_project_defaults(
            db,
            client_id=client_id,
            site_id=str(next_site_id) if next_site_id else None,
            current_project_id=billing_project_id,
        )

    for field, value in update_data.items():
        setattr(billing_project, field, value)

    db.add(billing_project)
    db.commit()
    db.refresh(billing_project)
    return _serialize_client_billing_project(billing_project, include_commercial=True)


@router.patch("/{client_id}/sites/{site_id}", response_model=schemas.client.ClientSite)
def update_client_site(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    site_id: str,
    site_in: schemas.client.ClientSiteUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    site = (
        db.query(models.ClientSite)
        .filter(
            models.ClientSite.id == site_id,
            models.ClientSite.client_id == client_id,
        )
        .first()
    )
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    update_data = site_in.model_dump(exclude_unset=True)
    next_site_code = update_data.get("site_code")
    if next_site_code and next_site_code != site.site_code:
        existing = (
            db.query(models.ClientSite)
            .filter(
                models.ClientSite.client_id == client_id,
                models.ClientSite.site_code == next_site_code,
                models.ClientSite.id != site.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Site code already exists for this client")

    for field, value in update_data.items():
        setattr(site, field, value)

    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.delete("/{client_id}/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_site(
    *,
    db: Session = Depends(get_db),
    client_id: str,
    site_id: str,
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> None:
    site = (
        db.query(models.ClientSite)
        .filter(
            models.ClientSite.id == site_id,
            models.ClientSite.client_id == client_id,
        )
        .first()
    )
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    db.delete(site)
    db.commit()
    return None

@router.post("/import/preview")
def preview_client_import(
    *,
    file: UploadFile = File(...),
    first_row_is_header: bool = Form(True),
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    columns, rows = read_tabular_upload(file, max_rows=5000, has_header=first_row_is_header)
    return {"columns": columns, "preview": rows, "total_rows": len(rows)}

@router.post("/import/confirm")
def import_clients(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    mapping: str = Form(...),
    selected_rows: str = Form(...),
    mode: str = Form("upsert"),
    first_row_is_header: bool = Form(True),
    current_user: models.User = Depends(require_permissions(PermissionCode.CLIENTS_MANAGE.value)),
) -> Any:
    try:
        mapping_dict = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mapping payload")

    if mode not in ALLOWED_IMPORT_MODES:
        raise HTTPException(status_code=400, detail="Invalid import mode")

    _, rows = read_tabular_upload(file, max_rows=5000, has_header=first_row_is_header)
    selected_row_indexes = parse_selected_row_indexes(selected_rows, len(rows))
    success_count = 0
    site_success_count = 0
    skipped_count = 0
    error_count = 0
    errors = []

    def _get(row: dict, field: str) -> Any:
        col = mapping_dict.get(field)
        return row.get(col, "") if col else ""

    def _clean(value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text if text else None

    seen_sites: dict[tuple[str, str], models.ClientSite] = {}
    renamed_clients: dict[str, models.Client] = {}

    for idx, row in enumerate(rows, start=1):
        row_index = idx - 1
        if row_index not in selected_row_indexes:
            continue

        try:
            name = _clean(_get(row, "name"))
            if not name:
                raise ValueError("Missing required name")

            client_payload = {
                "name": name,
                "client_number": _clean(_get(row, "client_number")),
                "project_number": _clean(_get(row, "project_number")),
                "vat_number": _clean(_get(row, "vat_number")),
                "address": _clean(_get(row, "address")),
                "city": _clean(_get(row, "city")),
                "country": _clean(_get(row, "country")),
                "email": _clean(_get(row, "email")),
                "phone": _clean(_get(row, "phone")),
                "notes": _clean(_get(row, "notes")),
            }

            existing = None
            if client_payload["client_number"]:
                existing = (
                    db.query(models.Client)
                    .filter(models.Client.client_number == client_payload["client_number"])
                    .first()
                )
            if existing is None and client_payload["email"]:
                existing = db.query(models.Client).filter(models.Client.email == client_payload["email"]).first()
            if existing is None and client_payload["vat_number"]:
                existing = db.query(models.Client).filter(models.Client.vat_number == client_payload["vat_number"]).first()
            if existing is None:
                existing = (
                    db.query(models.Client)
                    .filter(models.Client.name.ilike(name))
                    .first()
                )

            client_obj = existing
            if existing:
                if mode == "error":
                    raise ValueError(f"Client '{name}' already exists")
                if mode == "skip":
                    skipped_count += 1
                    continue
                if mode == "rename":
                    rename_key = str(existing.id)
                    client_obj = renamed_clients.get(rename_key)
                    if client_obj is None:
                        renamed_payload = dict(client_payload)
                        renamed_payload["name"] = _build_unique_client_name(db, name)
                        if renamed_payload["client_number"]:
                            renamed_payload["client_number"] = _build_unique_client_number(
                                db,
                                renamed_payload["client_number"],
                            )
                        client_obj = models.Client(**renamed_payload)
                        db.add(client_obj)
                        db.flush()
                        renamed_clients[rename_key] = client_obj
                        renamed_clients[str(client_obj.id)] = client_obj
                    else:
                        for k, v in client_payload.items():
                            if v is not None and not getattr(client_obj, k):
                                setattr(client_obj, k, v)
                    client_payload["name"] = client_obj.name
                    client_payload["client_number"] = client_obj.client_number
                    client_payload["email"] = client_payload["email"] or client_obj.email
                    client_payload["vat_number"] = client_payload["vat_number"] or client_obj.vat_number
                    client_payload["project_number"] = client_payload["project_number"] or client_obj.project_number
                    client_payload["notes"] = client_payload["notes"] or client_obj.notes
                    client_payload["phone"] = client_payload["phone"] or client_obj.phone
                    client_payload["address"] = client_payload["address"] or client_obj.address
                    client_payload["city"] = client_payload["city"] or client_obj.city
                    client_payload["country"] = client_payload["country"] or client_obj.country
                if mode == "upsert":
                    for k, v in client_payload.items():
                        if v is not None:
                            setattr(existing, k, v)
            else:
                client_obj = models.Client(**client_payload)
                db.add(client_obj)
                db.flush()  # ensure client id is available for related sites

            site_code = _clean(_get(row, "site_code"))
            site_name = _clean(_get(row, "site_name"))
            site_city = _clean(_get(row, "site_city"))
            site_address = _clean(_get(row, "site_address"))

            has_site_data = any([site_code, site_name, site_city, site_address])
            if has_site_data:
                if not site_code:
                    raise ValueError("Missing site code for row that contains site data")

                site_payload = {
                    "site_code": site_code,
                    "site_name": site_name or site_code,
                    "city": site_city,
                    "address": site_address,
                    "project_number": client_payload["project_number"],
                }

                key = (str(client_obj.id), site_code)

                existing_site = seen_sites.get(key)
                if existing_site is None:
                    existing_site = (
                        db.query(models.ClientSite)
                        .filter(
                            models.ClientSite.client_id == client_obj.id,
                            models.ClientSite.site_code == site_code,
                        )
                        .first()
                    )
                if existing_site:
                    if mode == "error":
                        raise ValueError(
                            f"Site with code '{site_code}' already exists for client '{client_obj.name}'"
                        )
                    if mode == "skip":
                        skipped_count += 1
                        continue
                    if mode == "rename":
                        site_payload["site_code"] = _build_unique_site_code(db, client_obj.id, site_code)
                        if site_payload["site_name"]:
                            site_payload["site_name"] = _prefix_import_value(site_payload["site_name"], fallback="site")
                        db_site = models.ClientSite(client=client_obj, **site_payload)
                        db.add(db_site)
                        db.flush()
                        existing_site = db_site
                    if mode == "upsert":
                        for k, v in site_payload.items():
                            if v is not None:
                                setattr(existing_site, k, v)
                else:
                    db_site = models.ClientSite(client=client_obj, **site_payload)
                    db.add(db_site)
                    db.flush()
                    existing_site = db_site
                seen_sites[key] = existing_site
                site_success_count += 1

            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx}: {e}")

    rolled_back = mode == "error" and error_count > 0
    final_success_count = 0 if rolled_back else success_count
    final_site_success_count = 0 if rolled_back else site_success_count

    if rolled_back:
        db.rollback()
    else:
        db.commit()

    return {
        "success": error_count == 0 and not rolled_back,
        "imported": final_success_count,
        "sites_imported": final_site_success_count,
        "skipped": skipped_count,
        "errors": error_count,
        "error_messages": errors,
        "rolled_back": rolled_back,
    }
