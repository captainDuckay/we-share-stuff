from typing import Final

from fastapi import Response

from app.config import Settings
from app.security import SESSION_TTL_DAYS

SECONDS_PER_DAY: Final = 24 * 60 * 60
SESSION_MAX_AGE_SECONDS: Final = SESSION_TTL_DAYS * SECONDS_PER_DAY
API_COOKIE_PATH: Final = "/api"
CSRF_COOKIE_PATH: Final = "/"
SAME_SITE_POLICY: Final = "lax"


def set_session_cookies(
    response: Response, settings: Settings, session_token: str, csrf_token: str
) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        session_token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=SAME_SITE_POLICY,
        path=API_COOKIE_PATH,
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=SAME_SITE_POLICY,
        path=CSRF_COOKIE_PATH,
    )


def set_anonymous_csrf_cookie(
    response: Response, settings: Settings, csrf_token: str
) -> None:
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=SAME_SITE_POLICY,
        path=CSRF_COOKIE_PATH,
    )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(settings.session_cookie_name, path=API_COOKIE_PATH)
