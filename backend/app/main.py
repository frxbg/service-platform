from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    auth,
    bootstrap,
    clients,
    equipment,
    materials,
    material_usages,
    mobile,
    offers,
    service_assignments,
    service_protocols,
    service_requests,
    settings as settings_router,
    users,
    warehouses,
    work_logs,
)

app = FastAPI(title="PyOffers API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(bootstrap.router, prefix="/auth", tags=["bootstrap"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(clients.router, prefix="/clients", tags=["clients"])
app.include_router(materials.router, prefix="/materials", tags=["materials"])
app.include_router(offers.router, prefix="/offers", tags=["offers"])
app.include_router(settings_router.router, prefix="/settings", tags=["settings"])
app.include_router(service_requests.router, prefix="/service-requests", tags=["service-requests"])
app.include_router(service_assignments.router, prefix="/service-assignments", tags=["service-assignments"])
app.include_router(work_logs.router, prefix="/work-logs", tags=["work-logs"])
app.include_router(material_usages.router, prefix="/material-usages", tags=["material-usages"])
app.include_router(warehouses.router, prefix="/warehouses", tags=["warehouses"])
app.include_router(equipment.router, prefix="/equipment", tags=["equipment"])
app.include_router(service_protocols.router, prefix="/service-protocols", tags=["service-protocols"])
app.include_router(mobile.router, prefix="/mobile", tags=["mobile"])

@app.get("/")
def read_root():
    return {"message": "Welcome to PyOffers API"}
