from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select

from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.models import Notification
from app.problems import problem
from app.schemas import (
    NOTIFICATION_LIST_DEFAULT_LIMIT,
    NOTIFICATION_LIST_MAX_LIMIT,
    NotificationEnvelope,
    NotificationResponse,
    NotificationsEnvelope,
    UnreadCountEnvelope,
)
from app.security import now_utc

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]


def notification_response(row: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=row.id,
        kind=row.kind,
        subject_id=row.subject_id,
        subject_status=row.subject_status,
        attention=row.attention,
        summary=row.summary,
        deep_link=row.deep_link or {},
        payload=row.payload or {},
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def unread_count_for(db: DatabaseSession, user_id: UUID) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.recipient_user_id == user_id,
            Notification.attention == "unread",
        )
    )
    return int(count or 0)


@router.get("", response_model=NotificationsEnvelope)
async def list_notifications(
    db: DatabaseSession,
    current: CurrentSessionDependency,
    limit: Annotated[
        int,
        Query(ge=1, le=NOTIFICATION_LIST_MAX_LIMIT),
    ] = NOTIFICATION_LIST_DEFAULT_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> NotificationsEnvelope:
    recipient_id = current.user.id
    total = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.recipient_user_id == recipient_id)
    )
    result = await db.scalars(
        select(Notification)
        .where(Notification.recipient_user_id == recipient_id)
        .order_by(Notification.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(result)
    return NotificationsEnvelope(
        notifications=[notification_response(row) for row in rows],
        unread_count=await unread_count_for(db, recipient_id),
        limit=limit,
        offset=offset,
        total=int(total or 0),
    )


@router.get("/unread-count", response_model=UnreadCountEnvelope)
async def get_unread_count(
    db: DatabaseSession, current: CurrentSessionDependency
) -> UnreadCountEnvelope:
    return UnreadCountEnvelope(
        unread_count=await unread_count_for(db, current.user.id)
    )


@router.post(
    "/{notification_id}/read",
    response_model=NotificationEnvelope,
    status_code=status.HTTP_200_OK,
)
async def mark_notification_read(
    notification_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> NotificationEnvelope:
    row = await db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_user_id == current.user.id,
        )
    )
    if row is None:
        raise problem(404, "notification_not_found", "Notification was not found")
    if row.attention != "read":
        row.attention = "read"
        row.updated_at = now_utc()
        await db.commit()
        await db.refresh(row)
    return NotificationEnvelope(notification=notification_response(row))
