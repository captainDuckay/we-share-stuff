from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.domain import (
    decline_pending_reservations_for_requester_in_group,
    group_summary,
    remove_member_item_sharing,
    require_group_creator,
    require_group_member,
    shared_item_response,
    sharing_group_response,
    user_summary,
)
from app.models import (
    Invitation,
    Item,
    ItemSharing,
    Reservation,
    SharingGroup,
    SharingGroupMember,
    User,
)
from app.notification_emission import (
    emit_invitation_notification,
    emit_reservation_request_notifications,
)
from app.problems import problem
from app.schemas import (
    InvitationAcceptEnvelope,
    InvitationCreate,
    InvitationEnvelope,
    InvitationResponse,
    InvitationsEnvelope,
    SharedItemEnvelope,
    SharedItemsEnvelope,
    SharingGroupEnvelope,
    SharingGroupInput,
    SharingGroupMemberResponse,
    SharingGroupMembersEnvelope,
    SharingGroupsEnvelope,
)
from app.security import normalize_email, now_utc

router = APIRouter(prefix="/api", tags=["sharing-groups"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]
InvitationStatus = Literal["pending", "accepted", "declined", "cancelled"]


async def invitation_response(
    db: DatabaseSession, invitation: Invitation
) -> InvitationResponse:
    return InvitationResponse(
        id=invitation.id,
        sharing_group=await group_summary(db, invitation.sharing_group_id),
        invited_email=invitation.invited_email,
        status=invitation.status,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
    )


async def pending_invitation(
    db: DatabaseSession, invitation_id: UUID, email: str
) -> Invitation:
    invitation = await db.scalar(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.invited_email == email,
        )
    )
    if invitation is None:
        raise problem(404, "invitation_not_found", "Invitation was not found")
    if invitation.status != "pending":
        raise problem(409, "invitation_not_pending", "Invitation is not pending")
    return invitation


@router.get("/sharing-groups", response_model=SharingGroupsEnvelope)
async def list_sharing_groups(
    db: DatabaseSession, current: CurrentSessionDependency
) -> SharingGroupsEnvelope:
    result = await db.scalars(
        select(SharingGroup)
        .join(SharingGroupMember)
        .where(SharingGroupMember.user_id == current.user.id)
        .order_by(SharingGroup.created_at.desc())
    )
    return SharingGroupsEnvelope(
        sharing_groups=[
            await sharing_group_response(db, group, current.user.id) for group in result
        ]
    )


@router.post(
    "/sharing-groups",
    response_model=SharingGroupEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def create_sharing_group(
    payload: SharingGroupInput,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> SharingGroupEnvelope:
    group = SharingGroup(name=payload.name, created_by_id=current.user.id)
    db.add(group)
    await db.flush()
    db.add(SharingGroupMember(sharing_group_id=group.id, user_id=current.user.id))
    await db.commit()
    await db.refresh(group)
    return SharingGroupEnvelope(
        sharing_group=await sharing_group_response(db, group, current.user.id)
    )


@router.get("/sharing-groups/{sharing_group_id}", response_model=SharingGroupEnvelope)
async def get_sharing_group(
    sharing_group_id: UUID, db: DatabaseSession, current: CurrentSessionDependency
) -> SharingGroupEnvelope:
    group = await require_group_member(db, sharing_group_id, current.user.id)
    return SharingGroupEnvelope(
        sharing_group=await sharing_group_response(db, group, current.user.id)
    )


@router.get(
    "/sharing-groups/{sharing_group_id}/members",
    response_model=SharingGroupMembersEnvelope,
)
async def list_sharing_group_members(
    sharing_group_id: UUID, db: DatabaseSession, current: CurrentSessionDependency
) -> SharingGroupMembersEnvelope:
    group = await require_group_member(db, sharing_group_id, current.user.id)
    result = await db.scalars(
        select(SharingGroupMember)
        .options(selectinload(SharingGroupMember.user))
        .where(SharingGroupMember.sharing_group_id == group.id)
        .order_by(SharingGroupMember.joined_at)
    )
    return SharingGroupMembersEnvelope(
        members=[
            SharingGroupMemberResponse(
                user=user_summary(member.user),
                joined_at=member.joined_at,
                is_creator=member.user_id == group.created_by_id,
            )
            for member in result
        ]
    )


async def emit_declined_reservations_from_membership_loss(
    db: DatabaseSession,
    *,
    declined: list[Reservation],
    actor_user_id: UUID,
) -> None:
    """Apply reservation_request Notification rules for system-driven declines."""
    for reservation in declined:
        item = await db.get(Item, reservation.item_id)
        if item is None:
            continue
        owner = await db.get(User, item.owner_id)
        requester = await db.get(User, reservation.requester_id)
        if owner is None or requester is None:
            continue
        await emit_reservation_request_notifications(
            db,
            reservation=reservation,
            item=item,
            owner=owner,
            requester=requester,
            actor_user_id=actor_user_id,
        )


@router.delete(
    "/sharing-groups/{sharing_group_id}/members/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def leave_sharing_group(
    sharing_group_id: UUID, db: DatabaseSession, current: AuthenticatedMutation
) -> None:
    group = await require_group_member(db, sharing_group_id, current.user.id)
    if group.created_by_id == current.user.id:
        raise problem(
            409,
            "sharing_group_creator_cannot_leave",
            "Sharing Group creator cannot leave",
        )
    declined = await decline_pending_reservations_for_requester_in_group(
        db, group.id, current.user.id
    )
    await emit_declined_reservations_from_membership_loss(
        db, declined=declined, actor_user_id=current.user.id
    )
    await remove_member_item_sharing(db, group.id, current.user.id)
    await db.execute(
        delete(SharingGroupMember).where(
            SharingGroupMember.sharing_group_id == group.id,
            SharingGroupMember.user_id == current.user.id,
        )
    )
    await db.commit()


@router.delete(
    "/sharing-groups/{sharing_group_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_sharing_group_member(
    sharing_group_id: UUID,
    user_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> None:
    group = await require_group_creator(db, sharing_group_id, current.user.id)
    if user_id == group.created_by_id:
        raise problem(
            409,
            "sharing_group_creator_cannot_leave",
            "Sharing Group creator cannot be removed",
        )
    member = await db.get(SharingGroupMember, (group.id, user_id))
    if member is None:
        raise problem(404, "member_not_found", "Member was not found")
    declined = await decline_pending_reservations_for_requester_in_group(
        db, group.id, user_id
    )
    await emit_declined_reservations_from_membership_loss(
        db, declined=declined, actor_user_id=current.user.id
    )
    await remove_member_item_sharing(db, group.id, user_id)
    await db.delete(member)
    await db.commit()


@router.post(
    "/sharing-groups/{sharing_group_id}/invitations",
    response_model=InvitationEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    sharing_group_id: UUID,
    payload: InvitationCreate,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> InvitationEnvelope:
    group = await require_group_creator(db, sharing_group_id, current.user.id)
    invited_email = normalize_email(str(payload.email))
    invited_user = await db.scalar(select(User).where(User.email == invited_email))
    if invited_user is not None:
        existing_member = await db.get(SharingGroupMember, (group.id, invited_user.id))
        if existing_member is not None:
            raise problem(
                409,
                "sharing_group_already_member",
                "User is already a Member",
            )
    existing_pending = await db.scalar(
        select(Invitation).where(
            Invitation.sharing_group_id == group.id,
            Invitation.invited_email == invited_email,
            Invitation.status == "pending",
        )
    )
    if existing_pending is not None:
        raise problem(
            409,
            "invitation_already_pending",
            "Invitation is already pending",
        )
    invitation = Invitation(sharing_group_id=group.id, invited_email=invited_email)
    db.add(invitation)
    await db.flush()
    inviter = await db.get(User, current.user.id)
    await emit_invitation_notification(
        db,
        invitation=invitation,
        sharing_group=group,
        inviter=inviter,
        actor_user_id=None,
    )
    await db.commit()
    await db.refresh(invitation)
    return InvitationEnvelope(invitation=await invitation_response(db, invitation))


@router.get(
    "/sharing-groups/{sharing_group_id}/invitations",
    response_model=InvitationsEnvelope,
)
async def list_group_invitations(
    sharing_group_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
    status_filter: InvitationStatus | None = Query(default=None, alias="status"),
) -> InvitationsEnvelope:
    group = await require_group_creator(db, sharing_group_id, current.user.id)
    query = select(Invitation).where(Invitation.sharing_group_id == group.id)
    if status_filter is not None:
        query = query.where(Invitation.status == status_filter)
    result = await db.scalars(query.order_by(Invitation.created_at.desc()))
    return InvitationsEnvelope(
        invitations=[await invitation_response(db, invitation) for invitation in result]
    )


@router.delete(
    "/sharing-groups/{sharing_group_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_invitation(
    sharing_group_id: UUID,
    invitation_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> None:
    group = await require_group_creator(db, sharing_group_id, current.user.id)
    invitation = await db.scalar(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.sharing_group_id == group.id,
        )
    )
    if invitation is None:
        raise problem(404, "invitation_not_found", "Invitation was not found")
    if invitation.status != "pending":
        raise problem(409, "invitation_not_pending", "Invitation is not pending")
    invitation.status = "cancelled"
    invitation.responded_at = now_utc()
    inviter = await db.get(User, current.user.id)
    await emit_invitation_notification(
        db,
        invitation=invitation,
        sharing_group=group,
        inviter=inviter,
        actor_user_id=current.user.id,
    )
    await db.commit()


@router.get("/invitations", response_model=InvitationsEnvelope)
async def list_my_invitations(
    db: DatabaseSession,
    current: CurrentSessionDependency,
    status_filter: InvitationStatus | None = Query(default=None, alias="status"),
) -> InvitationsEnvelope:
    query = select(Invitation).where(Invitation.invited_email == current.user.email)
    if status_filter is not None:
        query = query.where(Invitation.status == status_filter)
    result = await db.scalars(query.order_by(Invitation.created_at.desc()))
    return InvitationsEnvelope(
        invitations=[await invitation_response(db, invitation) for invitation in result]
    )


@router.post(
    "/invitations/{invitation_id}/accept", response_model=InvitationAcceptEnvelope
)
async def accept_invitation(
    invitation_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> InvitationAcceptEnvelope:
    invitation = await pending_invitation(db, invitation_id, current.user.email)
    group = await db.get(SharingGroup, invitation.sharing_group_id)
    if group is None:
        raise problem(404, "invitation_not_found", "Invitation was not found")
    if await db.get(SharingGroupMember, (group.id, current.user.id)) is not None:
        raise problem(409, "sharing_group_already_member", "User is already a Member")
    db.add(SharingGroupMember(sharing_group_id=group.id, user_id=current.user.id))
    invitation.status = "accepted"
    invitation.responded_at = now_utc()
    inviter = await db.get(User, group.created_by_id)
    await emit_invitation_notification(
        db,
        invitation=invitation,
        sharing_group=group,
        inviter=inviter,
        actor_user_id=current.user.id,
    )
    await db.commit()
    await db.refresh(invitation)
    await db.refresh(group)
    return InvitationAcceptEnvelope(
        invitation=await invitation_response(db, invitation),
        sharing_group=await sharing_group_response(db, group, current.user.id),
    )


@router.post("/invitations/{invitation_id}/decline", response_model=InvitationEnvelope)
async def decline_invitation(
    invitation_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> InvitationEnvelope:
    invitation = await pending_invitation(db, invitation_id, current.user.email)
    group = await db.get(SharingGroup, invitation.sharing_group_id)
    if group is None:
        raise problem(404, "invitation_not_found", "Invitation was not found")
    invitation.status = "declined"
    invitation.responded_at = now_utc()
    inviter = await db.get(User, group.created_by_id)
    await emit_invitation_notification(
        db,
        invitation=invitation,
        sharing_group=group,
        inviter=inviter,
        actor_user_id=current.user.id,
    )
    await db.commit()
    await db.refresh(invitation)
    return InvitationEnvelope(invitation=await invitation_response(db, invitation))


@router.get("/shared-items", response_model=SharedItemsEnvelope)
async def list_global_shared_items(
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> SharedItemsEnvelope:
    result = await db.scalars(
        select(Item)
        .join(ItemSharing, ItemSharing.item_id == Item.id)
        .join(
            SharingGroupMember,
            SharingGroupMember.sharing_group_id == ItemSharing.sharing_group_id,
        )
        .options(selectinload(Item.typical_location))
        .where(SharingGroupMember.user_id == current.user.id)
        .distinct()
        .order_by(Item.created_at.desc())
    )
    return SharedItemsEnvelope(
        shared_items=[
            await shared_item_response(db, item, current.user.id) for item in result
        ]
    )


@router.get("/shared-items/{item_id}", response_model=SharedItemEnvelope)
async def get_global_shared_item(
    item_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> SharedItemEnvelope:
    item = await db.scalar(
        select(Item)
        .join(ItemSharing, ItemSharing.item_id == Item.id)
        .join(
            SharingGroupMember,
            SharingGroupMember.sharing_group_id == ItemSharing.sharing_group_id,
        )
        .options(selectinload(Item.typical_location))
        .where(SharingGroupMember.user_id == current.user.id, Item.id == item_id)
    )
    if item is None:
        raise problem(404, "shared_item_not_found", "Shared Item was not found")
    return SharedItemEnvelope(
        shared_item=await shared_item_response(db, item, current.user.id)
    )


@router.get(
    "/sharing-groups/{sharing_group_id}/shared-items",
    response_model=SharedItemsEnvelope,
)
async def list_shared_items(
    sharing_group_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> SharedItemsEnvelope:
    group = await require_group_member(db, sharing_group_id, current.user.id)
    result = await db.scalars(
        select(Item)
        .join(ItemSharing, ItemSharing.item_id == Item.id)
        .options(selectinload(Item.typical_location))
        .where(ItemSharing.sharing_group_id == group.id)
        .order_by(Item.created_at.desc())
    )
    return SharedItemsEnvelope(
        shared_items=[
            await shared_item_response(db, item, current.user.id) for item in result
        ]
    )


@router.get(
    "/sharing-groups/{sharing_group_id}/shared-items/{item_id}",
    response_model=SharedItemEnvelope,
)
async def get_shared_item(
    sharing_group_id: UUID,
    item_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
) -> SharedItemEnvelope:
    group = await require_group_member(db, sharing_group_id, current.user.id)
    item = await db.scalar(
        select(Item)
        .join(ItemSharing, ItemSharing.item_id == Item.id)
        .options(selectinload(Item.typical_location))
        .where(ItemSharing.sharing_group_id == group.id, Item.id == item_id)
    )
    if item is None:
        raise problem(404, "shared_item_not_found", "Shared Item was not found")
    return SharedItemEnvelope(
        shared_item=await shared_item_response(db, item, current.user.id)
    )
