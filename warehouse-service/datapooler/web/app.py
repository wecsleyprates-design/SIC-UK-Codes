"""
Datapooler FastAPI Application.

This module initializes the main FastAPI application and automatically registers
all API routers from the routers module using inspection.

The application provides:
- Business matching endpoints
- NPI data lookup
- Export management
- Facts data operations
- Health check endpoints
"""

import inspect

import fastapi

from datapooler.web import routers

# Initialize FastAPI application
app = fastapi.FastAPI()

# Automatically discover and register all API routers from the routers module
# This uses introspection to find all APIRouter instances and include them
for name, obj in inspect.getmembers(routers):
    if isinstance(obj, fastapi.APIRouter):
        app.include_router(obj)


@app.get("/")
async def read_root() -> str:
    """Root endpoint - simple health check."""
    return "OK"


@app.get("/api/health")
async def healthcheck() -> str:
    """Health check endpoint for monitoring and load balancers."""
    return "OK"
