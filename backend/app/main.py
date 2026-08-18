from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    # Future: initialize database connections, run checks, etc.
    yield
    # Future: cleanup resources on shutdown


app = FastAPI(
    title="MedVault API",
    description="Privacy-first decentralized medical history ledger",
    version="0.1.0",
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
