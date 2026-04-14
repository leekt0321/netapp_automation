from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.admin_routes import router as admin_router
from app.api.auth_routes import router as auth_router
from app.api.board_routes import router as board_router
from app.api.log_routes import router as log_router
from app.api.site_routes import router as site_router
from app.api.web_routes import router as web_router
from app.config import settings
from app.core.lifecycle import on_startup
from app.core.paths import STATIC_DIR


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    app.include_router(web_router)
    app.include_router(admin_router)
    app.include_router(auth_router)
    app.include_router(log_router)
    app.include_router(site_router)
    app.include_router(board_router)
    app.add_event_handler("startup", lambda: on_startup(app))
    return app
