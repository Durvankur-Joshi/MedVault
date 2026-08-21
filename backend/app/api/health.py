import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import engine
from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Returns the current health status of the backend service and database."""
    db_status = "unavailable"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception as exc:
        logger.warning("Health check: database unreachable — %s", type(exc).__name__)
        db_status = "unreachable"

    overall = "ok" if db_status == "connected" else "degraded"
    return HealthResponse(status=overall, service="medvault-backend", database=db_status)
