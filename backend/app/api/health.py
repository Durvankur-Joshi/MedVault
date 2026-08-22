import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Returns the current health status of the backend service and database."""
    db_status = "unavailable"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception as exc:
        db_info = settings.safe_db_info
        logger.warning(
            "Health check: database unreachable — error_type=%s, db_host=%s, is_pooler=%s, is_direct=%s",
            type(exc).__name__,
            db_info.get("host"),
            db_info.get("is_pooler"),
            db_info.get("is_direct_supabase"),
        )
        db_status = "unreachable"

    overall = "ok" if db_status == "connected" else "degraded"
    return HealthResponse(status=overall, service="medvault-backend", database=db_status)

