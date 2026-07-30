from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.config import Settings, get_settings
from app.cookies import (
    clear_session_cookies,
    set_anonymous_csrf_cookie,
    set_session_cookies,
)
from app.csrf import csrf_value, require_anonymous_csrf, validate_origin
from app.dependencies import (
    CurrentSessionDependency,
    DatabaseSession,
    optional_current_session,
)
from app.models import Session, User
from app.problems import problem
from app.schemas import Credentials, RegistrationInput, UserEnvelope, UserResponse
from app.security import (
    hash_password,
    hash_secret,
    new_token,
    normalize_email,
    now_utc,
    session_expiry,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
AppSettings = Annotated[Settings, Depends(get_settings)]


def user_envelope(user: User) -> UserEnvelope:
    return UserEnvelope(
        user=UserResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            profile_photo_url=(
                f"/api/profile-photos/{user.id}/content"
                if user.profile_photo is not None
                else None
            ),
        )
    )


async def create_session(
    db: DatabaseSession, user: User, invalidate_existing: bool = False
) -> tuple[str, str]:
    if invalidate_existing:
        await db.execute(
            update(Session)
            .where(Session.user_id == user.id, Session.invalidated_at.is_(None))
            .values(invalidated_at=now_utc())
        )
    session_token = new_token()
    csrf_token = new_token()
    db.add(
        Session(
            token_digest=hash_secret(session_token),
            csrf_digest=hash_secret(csrf_token),
            user_id=user.id,
            expires_at=session_expiry(),
        )
    )
    await db.commit()
    return session_token, csrf_token


@router.post(
    "/register", response_model=UserEnvelope, status_code=status.HTTP_201_CREATED
)
async def register(
    credentials: RegistrationInput,
    response: Response,
    db: DatabaseSession,
    settings: AppSettings,
    _: None = Depends(require_anonymous_csrf),
) -> UserEnvelope:
    email = normalize_email(str(credentials.email))
    existing = await db.scalar(select(User.id).where(User.email == email))
    if existing is not None:
        raise problem(400, "registration_failed", "Registration failed")

    user = User(
        email=email,
        display_name=credentials.display_name,
        password_hash=hash_password(credentials.password),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise problem(400, "registration_failed", "Registration failed") from error
    await db.refresh(user)
    session_token, csrf_token = await create_session(db, user)
    set_session_cookies(response, settings, session_token, csrf_token)
    return user_envelope(user)


@router.post("/sign-in", response_model=UserEnvelope)
async def sign_in(
    credentials: Credentials,
    response: Response,
    db: DatabaseSession,
    settings: AppSettings,
    _: None = Depends(require_anonymous_csrf),
) -> UserEnvelope:
    email = normalize_email(str(credentials.email))
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise problem(401, "invalid_credentials", "Email or password is incorrect")

    session_token, csrf_token = await create_session(db, user, invalidate_existing=True)
    set_session_cookies(response, settings, session_token, csrf_token)
    return user_envelope(user)


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out(
    request: Request, response: Response, db: DatabaseSession, settings: AppSettings
) -> None:
    validate_origin(request, settings)
    csrf_value(request, settings)
    current = await optional_current_session(request, db, settings)
    if current is not None:
        current.session.invalidated_at = now_utc()
        await db.commit()
    clear_session_cookies(response, settings)
    set_anonymous_csrf_cookie(response, settings, new_token())


@router.get("/session", response_model=UserEnvelope)
async def get_session(
    request: Request,
    response: Response,
    current: CurrentSessionDependency,
    db: DatabaseSession,
    settings: AppSettings,
) -> UserEnvelope:
    if not request.cookies.get(settings.csrf_cookie_name):
        csrf_token = new_token()
        current.session.csrf_digest = hash_secret(csrf_token)
        await db.commit()
        set_anonymous_csrf_cookie(response, settings, csrf_token)
    return user_envelope(current.user)
