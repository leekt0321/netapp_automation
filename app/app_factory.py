import logging
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from app.api.admin_routes import router as admin_router
from app.api.auth_routes import router as auth_router
from app.api.board_routes import router as board_router
from app.api.log_routes import router as log_router
from app.api.site_routes import router as site_router
from app.api.web_routes import router as web_router
from app.config import settings
from app.core.lifecycle import on_startup
from app.core.logging_config import configure_logging
from app.core.paths import STATIC_DIR


configure_logging()
request_logger = logging.getLogger("storage_ai.http")


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started_at = perf_counter()
        client_host = request.client.host if request.client else "-"
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (perf_counter() - started_at) * 1000
            request_logger.exception(
                "request_failed method=%s path=%s client=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                client_host,
                duration_ms,
            )
            raise

        duration_ms = (perf_counter() - started_at) * 1000
        logger_method = request_logger.info
        if response.status_code >= 500:
            logger_method = request_logger.error
        elif response.status_code >= 400:
            logger_method = request_logger.warning
        logger_method(
            "request_completed method=%s path=%s status_code=%s client=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            client_host,
            duration_ms,
        )
        return response

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    app.include_router(web_router)
    app.include_router(admin_router)
    app.include_router(auth_router)
    app.include_router(log_router)
    app.include_router(site_router)
    app.include_router(board_router)
    app.add_event_handler("startup", lambda: on_startup(app))
    return app
