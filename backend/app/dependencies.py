from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_database_session
from app.models import Session, User
from app.problems import problem
from app.security import hash_secret, now_utc

DatabaseSession = Annotated[AsyncSession, Depends(get_database_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]


@dataclass(frozen=True)
class CurrentSession:
    user: User
    session: Session


async def current_session(
    request: Request, session: DatabaseSession, settings: AppSettings
) -> CurrentSession:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise problem(401, "unauthenticated", "Authentication required")

    result = await session.execute(
        select(Session, User)
        .join(User, User.id == Session.user_id)
        .where(
            Session.token_digest == hash_secret(token),
            Session.invalidated_at.is_(None),
            Session.expires_at > now_utc(),
        )
    )
    session_user = result.one_or_none()
    if session_user is None:
        raise problem(401, "unauthenticated", "Authentication required")
    active_session, user = session_user
    return CurrentSession(user=user, session=active_session)


CurrentSessionDependency = Annotated[CurrentSession, Depends(current_session)]


async def optional_current_session(
    request: Request, session: DatabaseSession, settings: AppSettings
) -> CurrentSession | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    result = await session.execute(
        select(Session, User)
        .join(User, User.id == Session.user_id)
        .where(
            Session.token_digest == hash_secret(token),
            Session.invalidated_at.is_(None),
            Session.expires_at > now_utc(),
        )
    )
    session_user = result.one_or_none()
    if session_user is None:
        return None
    active_session, user = session_user
    return CurrentSession(user=user, session=active_session)
