import hmac
from typing import Annotated, Final

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.dependencies import CurrentSession, DatabaseSession, current_session
from app.problems import problem
from app.security import hash_secret

CSRF_HEADER: Final = "X-XSRF-TOKEN"
UNSAFE_METHODS: Final = frozenset({"POST", "PATCH", "DELETE"})
AppSettings = Annotated[Settings, Depends(get_settings)]


def validate_origin(request: Request, settings: AppSettings) -> None:
    origin = request.headers.get("origin")
    if origin and origin not in settings.origins:
        raise problem(403, "origin_not_allowed", "Origin is not allowed")


def csrf_value(request: Request, settings: AppSettings) -> str:
    cookie_value = request.cookies.get(settings.csrf_cookie_name)
    header_value = request.headers.get(CSRF_HEADER)
    if (
        not cookie_value
        or not header_value
        or not hmac.compare_digest(cookie_value, header_value)
    ):
        raise problem(403, "csrf_invalid", "CSRF validation failed")
    return cookie_value


async def require_anonymous_csrf(request: Request, settings: AppSettings) -> None:
    validate_origin(request, settings)
    csrf_value(request, settings)


async def require_session_csrf(
    request: Request, session: DatabaseSession, settings: AppSettings
) -> CurrentSession:
    validate_origin(request, settings)
    session_context = await current_session(request, session, settings)
    value = csrf_value(request, settings)
    if not hmac.compare_digest(hash_secret(value), session_context.session.csrf_digest):
        raise problem(403, "csrf_invalid", "CSRF validation failed")
    return session_context
