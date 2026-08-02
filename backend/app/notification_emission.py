"""Shared durable Notification emission for domain mutations.

Call before commit on the same DB session. Failures must fail the mutation.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import as_utc
from app.models import Invitation, Item, Notification, Reservation, SharingGroup, User
from app.security import now_utc

KIND_INVITATION = "invitation"
KIND_RESERVATION_REQUEST = "reservation_request"


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
    create_if_missing: bool = True,
) -> Notification | None:
    """Create or contentfully update one Notification for subject × recipient.

    When create_if_missing is False and no row exists, returns None (no-op).
    """
    existing = await db.scalar(
        select(Notification).where(
            Notification.recipient_user_id == recipient_user_id,
            Notification.kind == kind,
            Notification.subject_id == subject_id,
        )
    )
    now = now_utc()
    if existing is None:
        if not create_if_missing:
            return None
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


def _iso_utc(value: datetime) -> str:
    return as_utc(value).isoformat().replace("+00:00", "Z")


def reservation_request_deep_link(*, reservation_id: UUID) -> dict:
    return {
        "surface": "reservations",
        "reservationId": str(reservation_id),
    }


def reservation_request_payload(
    *,
    reservation: Reservation,
    item: Item,
    other_party: User,
) -> dict:
    return {
        "reservationId": str(reservation.id),
        "itemId": str(item.id),
        "itemName": item.name,
        "otherPartyId": str(other_party.id),
        "otherPartyDisplayName": other_party.display_name,
        "startAt": _iso_utc(reservation.start_at),
        "endAt": _iso_utc(reservation.end_at),
        "timezone": reservation.timezone,
    }


def reservation_request_summary(
    *,
    subject_status: str,
    item_name: str,
    other_party_display_name: str,
    recipient_is_owner: bool,
) -> str:
    accepted = (
        f"You accepted the request for {item_name}"
        if recipient_is_owner
        else f"{other_party_display_name} accepted your request for {item_name}"
    )
    declined = (
        f"Request for {item_name} was declined"
        if recipient_is_owner
        else f"{other_party_display_name} declined your request for {item_name}"
    )
    summaries = {
        "pending": f"{other_party_display_name} requested {item_name}",
        "accepted": accepted,
        "declined": declined,
        "withdrawn": f"{other_party_display_name} withdrew the request for {item_name}",
        "cancelled": f"Reservation for {item_name} was cancelled",
    }
    return summaries.get(subject_status, f"Reservation update for {item_name}")


def _attention_for_recipient(
    *, actor_user_id: UUID | None, recipient_user_id: UUID
) -> str:
    if actor_user_id is not None and actor_user_id == recipient_user_id:
        return "read"
    return "unread"


async def emit_reservation_request_notifications(
    db: AsyncSession,
    *,
    reservation: Reservation,
    item: Item,
    owner: User,
    requester: User,
    actor_user_id: UUID | None,
) -> list[Notification]:
    """Upsert Reservation Request Notification rows per the v1 recipient matrix.

    One row per request × recipient, updated in place.
    - pending create → owner only
    - accept/decline → owner update; requester create (unless requester is actor)
    - withdraw → owner update only
    - cancel (accepted) → update if exists; create only for non-cancelling party
    """
    status = reservation.status
    deep_link = reservation_request_deep_link(reservation_id=reservation.id)
    emitted: list[Notification] = []

    async def emit_for(
        recipient: User,
        *,
        other_party: User,
        create_if_missing: bool,
        recipient_is_owner: bool,
    ) -> None:
        summary = reservation_request_summary(
            subject_status=status,
            item_name=item.name,
            other_party_display_name=other_party.display_name,
            recipient_is_owner=recipient_is_owner,
        )
        payload = reservation_request_payload(
            reservation=reservation,
            item=item,
            other_party=other_party,
        )
        attention = _attention_for_recipient(
            actor_user_id=actor_user_id, recipient_user_id=recipient.id
        )
        row = await upsert_notification(
            db,
            recipient_user_id=recipient.id,
            kind=KIND_RESERVATION_REQUEST,
            subject_id=reservation.id,
            subject_status=status,
            summary=summary,
            deep_link=deep_link,
            payload=payload,
            attention=attention,
            create_if_missing=create_if_missing,
        )
        if row is not None:
            emitted.append(row)

    if status == "pending":
        # Create path only notifies the owner (no requester self-notify).
        await emit_for(
            owner,
            other_party=requester,
            create_if_missing=True,
            recipient_is_owner=True,
        )
        return emitted

    if status in {"accepted", "declined"}:
        await emit_for(
            owner,
            other_party=requester,
            create_if_missing=True,
            recipient_is_owner=True,
        )
        # Requester gets the outcome unless they are the actor (no self-notify).
        if actor_user_id != requester.id:
            await emit_for(
                requester,
                other_party=owner,
                create_if_missing=True,
                recipient_is_owner=False,
            )
        return emitted

    if status == "withdrawn":
        await emit_for(
            owner,
            other_party=requester,
            create_if_missing=True,
            recipient_is_owner=True,
        )
        return emitted

    if status == "cancelled":
        canceller_id = actor_user_id
        # Owner: update if exists; create only when they are not the canceller.
        await emit_for(
            owner,
            other_party=requester,
            create_if_missing=canceller_id != owner.id,
            recipient_is_owner=True,
        )
        # Requester: update if exists; create only when they are not the canceller.
        await emit_for(
            requester,
            other_party=owner,
            create_if_missing=canceller_id != requester.id,
            recipient_is_owner=False,
        )
        return emitted

    return emitted
