from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, get_settings
from app.cookies import set_anonymous_csrf_cookie
from app.database import engine
from app.dependencies import DatabaseSession
from app.problems import PROBLEM_TYPE_ROOT, problem
from app.routers import (
    auth,
    item_photos,
    items,
    placement_surfaces,
    profile,
    reservations,
    sharing_group_photos,
    sharing_groups,
    typical_locations,
)
from app.security import new_token


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


def problem_response(status_code: int, detail: object) -> JSONResponse:
    if (
        isinstance(detail, dict)
        and {"type", "title", "status", "code"} <= detail.keys()
    ):
        body = detail
    else:
        body = {
            "type": f"{PROBLEM_TYPE_ROOT}http-error",
            "title": "Request failed",
            "status": status_code,
            "code": "http_error",
        }
    return JSONResponse(
        status_code=status_code, content=body, media_type="application/problem+json"
    )


def validation_errors(error: RequestValidationError) -> dict[str, str]:
    return {
        ".".join(str(part) for part in item["loc"][1:]) or "body": item["msg"]
        for item in error.errors()
    }


def create_app(settings: Settings | None = None) -> FastAPI:
    configured_settings = settings or get_settings()
    application = FastAPI(title="We Share Stuff API", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured_settings.origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-XSRF-TOKEN"],
    )

    @application.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @application.exception_handler(RequestValidationError)
    async def handle_validation(
        _: Request, error: RequestValidationError
    ) -> JSONResponse:
        return problem_response(
            400,
            {
                "type": f"{PROBLEM_TYPE_ROOT}validation-failed",
                "title": "Validation failed",
                "status": 400,
                "code": "validation_failed",
                "errors": validation_errors(error),
            },
        )

    @application.exception_handler(HTTPException)
    @application.exception_handler(StarletteHTTPException)
    async def handle_http(
        request: Request, error: HTTPException | StarletteHTTPException
    ) -> JSONResponse:
        response = problem_response(error.status_code, error.detail)
        if request.url.path == "/api/auth/session" and error.status_code == 401:
            set_anonymous_csrf_cookie(response, configured_settings, new_token())
        return response

    @application.exception_handler(Exception)
    async def handle_unexpected(_: Request, __: Exception) -> JSONResponse:
        return problem_response(
            500,
            {
                "type": f"{PROBLEM_TYPE_ROOT}internal-error",
                "title": "Internal server error",
                "status": 500,
                "code": "internal_error",
            },
        )

    @application.get("/health")
    async def health_check(session: DatabaseSession) -> dict[str, str]:
        try:
            await session.execute(text("SELECT 1"))
        except SQLAlchemyError as error:
            raise problem(
                503, "database_unavailable", "Database is unavailable"
            ) from error
        return {"status": "ok"}

    application.include_router(auth.router)
    application.include_router(typical_locations.router)
    application.include_router(placement_surfaces.router)
    application.include_router(items.router)
    application.include_router(item_photos.router)
    application.include_router(profile.router)
    application.include_router(sharing_groups.router)
    application.include_router(sharing_group_photos.router)
    application.include_router(reservations.router)
    return application


app = create_app()
