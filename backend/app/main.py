from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.roles import router as roles_router
from app.api.records import router as records_router
from app.api.consent import router as consent_router
from app.api.access_requests import router as access_requests_router
from app.api.audit import router as audit_router
from app.api.patients import router as patients_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    yield


app = FastAPI(
    title="MedVault API",
    description="Privacy-first decentralized medical history ledger",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS configuration — origins loaded from environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(roles_router)
app.include_router(records_router)
app.include_router(consent_router)
app.include_router(access_requests_router)
app.include_router(audit_router)
app.include_router(patients_router)
