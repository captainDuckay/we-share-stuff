"""Shared durable Notification emission for domain mutations.

Call before commit on the same DB session. Failures must fail the mutation.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Invitation, Notification, SharingGroup, User
from app.security import now_utc

KIND_INVITATION = "invitation"


async def upsert_notification(
    db: AsyncSession,
    *,
    recipient_user_id: UUID,
    kind: str,
    subject_id: UUID,
    subject_status: str,
    summary: str,
    deep_link: dict,
    payload: dict,
    attention: str,
) -> Notification:
    """Create or contentfully update one Notification for subject × recipient."""
    existing = await db.scalar(
        select(Notification).where(
            Notification.recipient_user_id == recipient_user_id,
            Notification.kind == kind,
            Notification.subject_id == subject_id,
        )
    )
    now = now_utc()
    if existing is None:
        row = Notification(
            recipient_user_id=recipient_user_id,
            kind=kind,
            subject_id=subject_id,
            subject_status=subject_status,
            attention=attention,
            summary=summary,
            deep_link=deep_link,
            payload=payload,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
        await db.flush()
        return row

    existing.subject_status = subject_status
    existing.summary = summary
    existing.deep_link = deep_link
    existing.payload = payload
    existing.attention = attention
    existing.updated_at = now
    await db.flush()
    return existing


def invitation_summary(
    *,
    subject_status: str,
    sharing_group_name: str,
    inviter_display_name: str | None,
) -> str:
    pending = (
        f"{inviter_display_name} invited you to {sharing_group_name}"
        if inviter_display_name
        else f"You're invited to {sharing_group_name}"
    )
    summaries = {
        "pending": pending,
        "accepted": f"You joined {sharing_group_name}",
        "declined": f"You declined the invitation to {sharing_group_name}",
        "cancelled": f"Invitation to {sharing_group_name} was cancelled",
    }
    return summaries.get(
        subject_status, f"Invitation update for {sharing_group_name}"
    )


def invitation_deep_link(
    *, subject_status: str, sharing_group_id: UUID
) -> dict:
    if subject_status == "accepted":
        return {
            "surface": "sharing_group",
            "sharingGroupId": str(sharing_group_id),
        }
    return {"surface": "home"}


def invitation_payload(
    *,
    sharing_group_id: UUID,
    sharing_group_name: str,
    inviter_display_name: str | None,
) -> dict:
    payload: dict = {
        "sharingGroupId": str(sharing_group_id),
        "sharingGroupName": sharing_group_name,
    }
    if inviter_display_name:
        payload["inviterDisplayName"] = inviter_display_name
    return payload


async def emit_invitation_notification(
    db: AsyncSession,
    *,
    invitation: Invitation,
    sharing_group: SharingGroup,
    inviter: User | None,
    actor_user_id: UUID | None,
) -> Notification | None:
    """Upsert the invitee's invitation Notification for the current subject state.

    Recipient is the invited User only (no inviter self-notify).
    Returns None when no registered User matches the invited email.
    """
    invitee = await db.scalar(
        select(User).where(User.email == invitation.invited_email)
    )
    if invitee is None:
        return None

    inviter_name = inviter.display_name if inviter is not None else None
    status = invitation.status
    summary = invitation_summary(
        subject_status=status,
        sharing_group_name=sharing_group.name,
        inviter_display_name=inviter_name,
    )
    deep_link = invitation_deep_link(
        subject_status=status, sharing_group_id=sharing_group.id
    )
    payload = invitation_payload(
        sharing_group_id=sharing_group.id,
        sharing_group_name=sharing_group.name,
        inviter_display_name=inviter_name,
    )

    # Create → Unread; passive contentful update → Unread; actor own-action → Read.
    if actor_user_id is not None and actor_user_id == invitee.id:
        attention = "read"
    else:
        attention = "unread"

    return await upsert_notification(
        db,
        recipient_user_id=invitee.id,
        kind=KIND_INVITATION,
        subject_id=invitation.id,
        subject_status=status,
        summary=summary,
        deep_link=deep_link,
        payload=payload,
        attention=attention,
    )
