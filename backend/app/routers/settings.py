from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os
import shutil

from app import models, schemas
from app.core import deps
from app.core.permissions import PermissionCode, require_permissions
from app.database import get_db

router = APIRouter()


@router.get("/company", response_model=schemas.company_settings.CompanySettings)
def get_company_settings(
    *,
    db: Session = Depends(get_db),
) -> models.CompanySettings:
    """
    Get company settings. Creates default if not exists.
    """
    settings = db.query(models.CompanySettings).first()
    
    if not settings:
        # Create default settings
        settings = models.CompanySettings(
            company_name="Моята Компания",
            company_address="",
            company_phone="",
            company_email="",
            session_timeout_minutes=0,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings


@router.put("/company", response_model=schemas.company_settings.CompanySettings)
def update_company_settings(
    *,
    db: Session = Depends(get_db),
    settings_in: schemas.company_settings.CompanySettingsUpdate,
    current_user: models.User = Depends(require_permissions(PermissionCode.SETTINGS_MANAGE.value)),
) -> models.CompanySettings:
    """
    Update company settings. Admin only.
    """
    settings = db.query(models.CompanySettings).first()
    
    if not settings:
        # Create if not exists
        settings = models.CompanySettings()
        db.add(settings)
    
    # Update fields
    update_data = settings_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return settings


@router.get("/template")
def get_template(
    current_user: models.User = Depends(require_permissions(PermissionCode.SETTINGS_MANAGE.value)),
):
    """
    Get current PDF template content.
    """
    template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
    template_path = os.path.join(template_dir, 'offer_template.html')
    
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template file not found")
    
    with open(template_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    return {"content": content}


@router.put("/template")
def update_template(
    content: dict,
    current_user: models.User = Depends(require_permissions(PermissionCode.SETTINGS_MANAGE.value)),
):
    """
    Update PDF template content. Admin only.
    """
    template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
    template_path = os.path.join(template_dir, 'offer_template.html')
    
    template_content = content.get("content", "")
    if not template_content:
        raise HTTPException(status_code=400, detail="Template content is required")
    
    with open(template_path, 'w', encoding='utf-8') as f:
        f.write(template_content)
    
    return {"message": "Template updated successfully"}


@router.post("/template/reset")
def reset_template(
    current_user: models.User = Depends(require_permissions(PermissionCode.SETTINGS_MANAGE.value)),
):
    """
    Reset template to base version. Admin only.
    """
    template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
    base_template_path = os.path.join(template_dir, 'offer_template_base.html')
    template_path = os.path.join(template_dir, 'offer_template.html')
    
    if not os.path.exists(base_template_path):
        raise HTTPException(status_code=404, detail="Base template file not found")
    
    # Copy base template to active template
    shutil.copy2(base_template_path, template_path)
    
    return {"message": "Template reset to original successfully"}
