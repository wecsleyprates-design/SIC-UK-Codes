from datapooler.web.routers.business.routes import router as business_router
from datapooler.web.routers.export.routes import router as export_router
from datapooler.web.routers.facts.routes import router as facts_router
from datapooler.web.routers.matching.routes import router as match_router
from datapooler.web.routers.npi.routes import router as npi_router
from datapooler.web.routers.queue.routes import router as queue_router

__all__ = (
    "match_router",
    "facts_router",
    "npi_router",
    "business_router",
    "queue_router",
    "export_router",
)
