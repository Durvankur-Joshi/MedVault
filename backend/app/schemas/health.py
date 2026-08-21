from typing import Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response schema for the health check endpoint."""

    status: str
    service: str
    database: Optional[str] = None
