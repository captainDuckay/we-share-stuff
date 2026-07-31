import asyncio
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import SharingGroupMember

PASSWORD = "a secure password"
ORIGIN = "http://localhost:4200"


@dataclass(frozen=True)
class ApiSession:
    user_id: str
    cookies: dict[str, str]
    headers: dict[str, str]


def register_user(
    client: TestClient, email: str, display_name: str = "Test User"
) -> ApiSession:
    client.cookies.clear()
    client.get("/api/auth/session")
    token = client.cookies.get("XSRF-TOKEN")
    response = client.post(
        "/api/auth/register",
        headers={"Origin": ORIGIN, "X-XSRF-TOKEN": token},
        json={"email": email, "password": PASSWORD, "displayName": display_name},
    )
    assert response.status_code == 201
    session = client.cookies.get("wss_session")
    csrf = client.cookies.get("XSRF-TOKEN")
    assert session and csrf
    return ApiSession(
        user_id=response.json()["user"]["id"],
        cookies={"wss_session": session, "XSRF-TOKEN": csrf},
        headers={"Origin": ORIGIN, "X-XSRF-TOKEN": csrf},
    )


def use_session(client: TestClient, session: ApiSession) -> dict[str, str]:
    client.cookies.clear()
    for name, value in session.cookies.items():
        client.cookies.set(name, value)
    return session.headers


def create_location(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/typical-locations",
        headers=headers,
        json={
            "name": "  Home  ",
            "details": "  Main Street 1  ",
            "timezone": "Europe/Copenhagen",
        },
    )
    assert response.status_code == 201
    return response.json()["typicalLocation"]


def create_item(
    client: TestClient,
    headers: dict[str, str],
    location_id: str | None = None,
    placement: str | None = None,
) -> dict:
    payload: dict[str, str | None] = {"name": "  Tent  ", "description": "Two person"}
    if location_id is not None:
        payload["typicalLocationId"] = location_id
    if placement is not None:
        payload["typicalPlacement"] = placement
    response = client.post("/api/items", headers=headers, json=payload)
    assert response.status_code == 201
    return response.json()["item"]


def upload_photo(client: TestClient, headers: dict[str, str], item_id: str) -> dict:
    response = client.post(
        f"/api/items/{item_id}/photos",
        headers=headers,
        files={"file": ("tent.png", b"not really a png but stored", "image/png")},
    )
    assert response.status_code == 201
    return response.json()["itemPhoto"]


def remove_membership_without_closing_pending(
    tmp_path: Path, group_id: str, user_id: str
) -> None:
    async def remove_membership() -> None:
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as session:
            await session.execute(
                delete(SharingGroupMember).where(
                    SharingGroupMember.sharing_group_id == UUID(group_id),
                    SharingGroupMember.user_id == UUID(user_id),
                )
            )
            await session.commit()
        await engine.dispose()

    asyncio.run(remove_membership())


def create_group_and_invite_member(
    client: TestClient,
    owner: ApiSession,
    member: ApiSession,
    member_email: str,
) -> str:
    owner_headers = use_session(client, owner)
    group_response = client.post(
        "/api/sharing-groups", headers=owner_headers, json={"name": "Friends"}
    )
    assert group_response.status_code == 201
    group_id = group_response.json()["sharingGroup"]["id"]
    invitation_response = client.post(
        f"/api/sharing-groups/{group_id}/invitations",
        headers=owner_headers,
        json={"email": member_email},
    )
    assert invitation_response.status_code == 201
    invitation_id = invitation_response.json()["invitation"]["id"]

    member_headers = use_session(client, member)
    accepted = client.post(
        f"/api/invitations/{invitation_id}/accept", headers=member_headers
    )
    assert accepted.status_code == 200
    return group_id


def test_typical_location_crud_and_private_item_assignment(
    client: TestClient,
) -> None:
    user = register_user(client, "location-owner@example.com")
    headers = use_session(client, user)
    location = create_location(client, headers)
    assert location["name"] == "Home"
    assert location["details"] == "Main Street 1"
    assert location["timezone"] == "Europe/Copenhagen"

    item = create_item(client, headers)
    assert item["typicalLocation"] is None
    updated = client.patch(
        f"/api/items/{item['id']}",
        headers=headers,
        json={"typicalLocationId": location["id"], "typicalPlacement": " Garage "},
    )
    assert updated.status_code == 200
    assert updated.json()["item"]["typicalLocation"]["id"] == location["id"]
    assert updated.json()["item"]["typicalPlacement"] == "Garage"

    locations = client.get("/api/typical-locations")
    assert locations.status_code == 200
    assert locations.json()["typicalLocations"][0]["assignedItemCount"] == 1
    filtered_items = client.get(
        "/api/items", params={"typicalLocationId": location["id"]}
    )
    assert filtered_items.status_code == 200
    assert [entry["id"] for entry in filtered_items.json()["items"]] == [item["id"]]

    in_use_delete = client.delete(
        f"/api/typical-locations/{location['id']}", headers=headers
    )
    assert in_use_delete.status_code == 409
    assert in_use_delete.json()["code"] == "typical_location_in_use"


def test_item_photo_upload_storage_and_private_access(client: TestClient) -> None:
    owner = register_user(client, "photo-owner@example.com")
    other = register_user(client, "photo-other@example.com")
    owner_headers = use_session(client, owner)
    item = create_item(client, owner_headers)

    unsupported = client.post(
        f"/api/items/{item['id']}/photos",
        headers=owner_headers,
        files={"file": ("tent.gif", b"gif", "image/gif")},
    )
    assert unsupported.status_code == 415
    assert unsupported.json()["code"] == "item_photo_unsupported_type"

    photo = upload_photo(client, owner_headers, item["id"])
    assert photo["url"] == f"/api/item-photos/{photo['id']}/content"
    content = client.get(photo["url"])
    assert content.status_code == 200
    assert content.content == b"not really a png but stored"

    use_session(client, other)
    hidden = client.get(photo["url"])
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "item_photo_not_found"


def test_sharing_group_photo_management_and_member_visibility(
    client: TestClient,
) -> None:
    owner = register_user(client, "group-photo-owner@example.com")
    member = register_user(client, "group-photo-member@example.com")
    group_id = create_group_and_invite_member(
        client, owner, member, "group-photo-member@example.com"
    )

    member_headers = use_session(client, member)
    forbidden = client.post(
        f"/api/sharing-groups/{group_id}/photo",
        headers=member_headers,
        files={"file": ("group.png", b"\x89PNG\r\n\x1a\ngroup", "image/png")},
    )
    assert forbidden.status_code == 404

    owner_headers = use_session(client, owner)
    invalid_image = client.post(
        f"/api/sharing-groups/{group_id}/photo",
        headers=owner_headers,
        files={"file": ("group.png", b"not a png", "image/png")},
    )
    assert invalid_image.status_code == 415
    assert invalid_image.json()["code"] == "sharing_group_photo_invalid_image"

    uploaded = client.post(
        f"/api/sharing-groups/{group_id}/photo",
        headers=owner_headers,
        files={"file": ("group.png", b"\x89PNG\r\n\x1a\ngroup", "image/png")},
    )
    assert uploaded.status_code == 200
    photo_url = uploaded.json()["sharingGroup"]["photoUrl"]
    assert photo_url == f"/api/sharing-groups/{group_id}/photo/content"

    use_session(client, member)
    group = client.get(f"/api/sharing-groups/{group_id}")
    assert group.status_code == 200
    assert group.json()["sharingGroup"]["photoUrl"] == photo_url
    content = client.get(photo_url)
    assert content.status_code == 200
    assert content.content == b"\x89PNG\r\n\x1a\ngroup"
    assert content.headers["x-content-type-options"] == "nosniff"

    owner_headers = use_session(client, owner)
    removed = client.delete(
        f"/api/sharing-groups/{group_id}/photo", headers=owner_headers
    )
    assert removed.status_code == 204
    without_photo = client.get(f"/api/sharing-groups/{group_id}")
    assert without_photo.json()["sharingGroup"]["photoUrl"] is None

    use_session(client, member)
    assert client.get(photo_url).status_code == 404


def test_sharing_groups_invitations_and_binary_shared_item_visibility(
    client: TestClient,
) -> None:
    owner = register_user(client, "sharing-owner@example.com")
    member = register_user(client, "sharing-member@example.com")
    group_id = create_group_and_invite_member(
        client, owner, member, "sharing-member@example.com"
    )

    owner_headers = use_session(client, owner)
    unready_item = create_item(client, owner_headers)
    unready_share = client.post(
        f"/api/items/{unready_item['id']}/sharing-groups/{group_id}",
        headers=owner_headers,
    )
    assert unready_share.status_code == 409
    assert unready_share.json()["code"] == "item_not_share_ready"
    assert set(unready_share.json()["errors"]) == {"typicalLocation"}

    location = create_location(client, owner_headers)
    item = create_item(client, owner_headers, location["id"], "Shelf A")
    shared = client.post(
        f"/api/items/{item['id']}/sharing-groups/{group_id}",
        headers=owner_headers,
    )
    assert shared.status_code == 201
    assert shared.json()["itemSharing"]["sharingGroup"]["id"] == group_id

    photo = upload_photo(client, owner_headers, item["id"])
    owned_items = client.get("/api/items")
    assert owned_items.status_code == 200
    assert owned_items.json()["items"][0]["photoUrl"] == photo["url"]
    assert "visual" not in owned_items.json()["items"][0]

    member_headers = use_session(client, member)
    shared_items = client.get(f"/api/sharing-groups/{group_id}/shared-items")
    assert shared_items.status_code == 200
    shared_item = shared_items.json()["sharedItems"][0]
    assert shared_item["id"] == item["id"]
    assert shared_item["typicalLocation"]["id"] == location["id"]
    assert shared_item["typicalPlacement"] == {"visible": False, "value": None}
    assert shared_item["itemPhotos"][0]["id"] == photo["id"]
    assert "visual" not in shared_item
    assert client.get(photo["url"]).status_code == 200

    owner_headers = use_session(client, owner)
    removed = client.delete(
        f"/api/items/{item['id']}/photos/{photo['id']}", headers=owner_headers
    )
    assert removed.status_code == 204

    member_headers = use_session(client, member)
    shared_items = client.get(f"/api/sharing-groups/{group_id}/shared-items")
    assert shared_items.json()["sharedItems"][0]["itemPhotos"] == []

    leave = client.delete(
        f"/api/sharing-groups/{group_id}/members/me", headers=member_headers
    )
    assert leave.status_code == 204
    hidden = client.get(f"/api/sharing-groups/{group_id}/shared-items")
    assert hidden.status_code == 404


def test_reservation_owner_approval_conflict_and_placement_disclosure(
    client: TestClient,
) -> None:
    owner = register_user(client, "reservation-owner@example.com")
    member = register_user(client, "reservation-member@example.com")
    group_id = create_group_and_invite_member(
        client, owner, member, "reservation-member@example.com"
    )

    owner_headers = use_session(client, owner)
    location = create_location(client, owner_headers)
    item = create_item(client, owner_headers, location["id"], "Blue bin")
    photo = upload_photo(client, owner_headers, item["id"])
    share = client.post(
        f"/api/items/{item['id']}/sharing-groups/{group_id}", headers=owner_headers
    )
    assert share.status_code == 201

    member_headers = use_session(client, member)
    request = client.post(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}/reservations",
        headers=member_headers,
        json={"startLocal": "2099-08-01T10:00:00", "endLocal": "2099-08-01T12:00:00"},
    )
    assert request.status_code == 201
    reservation = request.json()["reservation"]
    assert reservation["status"] == "pending"
    assert reservation["timezone"] == "Europe/Copenhagen"
    assert reservation["startAt"] == "2099-08-01T08:00:00Z"
    assert reservation["item"]["photoUrl"] == photo["url"]
    assert "visual" not in reservation["item"]
    assert reservation["item"]["typicalPlacement"] == {"visible": False, "value": None}

    owner_headers = use_session(client, owner)
    accepted = client.post(
        f"/api/reservations/{reservation['id']}/accept", headers=owner_headers
    )
    assert accepted.status_code == 200
    assert accepted.json()["reservation"]["status"] == "accepted"
    assert accepted.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }

    member_headers = use_session(client, member)
    visible = client.get(f"/api/reservations/{reservation['id']}")
    assert visible.status_code == 200
    assert visible.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }
    conflicting = client.post(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}/reservations",
        headers=member_headers,
        json={"startLocal": "2099-08-01T11:00:00", "endLocal": "2099-08-01T13:00:00"},
    )
    assert conflicting.status_code == 409
    assert conflicting.json()["code"] == "reservation_conflict"

    owner_headers = use_session(client, owner)
    delete_blocked = client.delete(f"/api/items/{item['id']}", headers=owner_headers)
    assert delete_blocked.status_code == 409
    assert delete_blocked.json()["code"] == "item_has_future_accepted_reservations"

    unshare = client.delete(
        f"/api/items/{item['id']}/sharing-groups/{group_id}", headers=owner_headers
    )
    assert unshare.status_code == 204
    clear_location = client.patch(
        f"/api/items/{item['id']}",
        headers=owner_headers,
        json={"typicalLocationId": None},
    )
    assert clear_location.status_code == 409
    assert (
        clear_location.json()["code"] == "item_typical_location_locked_by_reservations"
    )
    other_location = create_location(client, owner_headers)
    change_location = client.patch(
        f"/api/items/{item['id']}",
        headers=owner_headers,
        json={"typicalLocationId": other_location["id"]},
    )
    assert change_location.status_code == 409
    assert (
        change_location.json()["code"] == "item_typical_location_locked_by_reservations"
    )
    delete_location = client.delete(
        f"/api/typical-locations/{location['id']}", headers=owner_headers
    )
    assert delete_location.status_code == 409
    assert delete_location.json()["code"] == "typical_location_in_use"

    member_headers = use_session(client, member)
    still_visible_reservation = client.get(f"/api/reservations/{reservation['id']}")
    assert still_visible_reservation.status_code == 200
    shared_item_gone = client.get(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}"
    )
    assert shared_item_gone.status_code == 404


def shared_reservation_fixture(
    client: TestClient, owner_email: str, member_email: str
) -> tuple[ApiSession, ApiSession, str, dict]:
    owner = register_user(client, owner_email)
    member = register_user(client, member_email)
    group_id = create_group_and_invite_member(client, owner, member, member_email)

    owner_headers = use_session(client, owner)
    location = create_location(client, owner_headers)
    item = create_item(client, owner_headers, location["id"], "Blue bin")
    upload_photo(client, owner_headers, item["id"])
    share = client.post(
        f"/api/items/{item['id']}/sharing-groups/{group_id}", headers=owner_headers
    )
    assert share.status_code == 201
    return owner, member, group_id, item


def request_pending_reservation(
    client: TestClient,
    member: ApiSession,
    group_id: str,
    item_id: str,
    start_local: str = "2099-09-01T10:00:00",
    end_local: str = "2099-09-01T12:00:00",
) -> dict:
    member_headers = use_session(client, member)
    response = client.post(
        f"/api/sharing-groups/{group_id}/shared-items/{item_id}/reservations",
        headers=member_headers,
        json={"startLocal": start_local, "endLocal": end_local},
    )
    assert response.status_code == 201
    return response.json()["reservation"]


def test_reservation_request_in_past_is_rejected(client: TestClient) -> None:
    _, member, group_id, item = shared_reservation_fixture(
        client, "past-owner@example.com", "past-member@example.com"
    )

    member_headers = use_session(client, member)
    response = client.post(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}/reservations",
        headers=member_headers,
        json={"startLocal": "2000-01-01T10:00:00", "endLocal": "2000-01-01T12:00:00"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "reservation_time_invalid"
    assert response.json()["errors"] == {"startLocal": "must be in the future"}


@pytest.mark.parametrize("loss_mode", ["leave", "remove"])
def test_pending_reservation_declined_when_requester_loses_group_membership(
    client: TestClient, loss_mode: str
) -> None:
    owner, member, group_id, item = shared_reservation_fixture(
        client,
        f"pending-{loss_mode}-owner@example.com",
        f"pending-{loss_mode}-member@example.com",
    )
    reservation = request_pending_reservation(client, member, group_id, item["id"])

    if loss_mode == "leave":
        member_headers = use_session(client, member)
        membership_loss = client.delete(
            f"/api/sharing-groups/{group_id}/members/me", headers=member_headers
        )
    else:
        owner_headers = use_session(client, owner)
        membership_loss = client.delete(
            f"/api/sharing-groups/{group_id}/members/{member.user_id}",
            headers=owner_headers,
        )
    assert membership_loss.status_code == 204

    member_headers = use_session(client, member)
    closed = client.get(f"/api/reservations/{reservation['id']}")
    assert closed.status_code == 200
    assert closed.json()["reservation"]["status"] == "declined"
    assert closed.json()["reservation"]["decidedAt"] is not None
    assert closed.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": False,
        "value": None,
    }

    owner_headers = use_session(client, owner)
    accept = client.post(
        f"/api/reservations/{reservation['id']}/accept", headers=owner_headers
    )
    assert accept.status_code == 409
    assert accept.json()["code"] == "reservation_not_pending"


def test_accept_pending_reservation_remains_actionable_after_unsharing(
    client: TestClient,
) -> None:
    owner, member, group_id, item = shared_reservation_fixture(
        client,
        "unshared-accept-owner@example.com",
        "unshared-accept-member@example.com",
    )
    reservation = request_pending_reservation(client, member, group_id, item["id"])

    owner_headers = use_session(client, owner)
    unshare = client.delete(
        f"/api/items/{item['id']}/sharing-groups/{group_id}", headers=owner_headers
    )
    assert unshare.status_code == 204
    accept = client.post(
        f"/api/reservations/{reservation['id']}/accept", headers=owner_headers
    )

    assert accept.status_code == 200
    assert accept.json()["reservation"]["status"] == "accepted"


def test_accept_pending_reservation_remains_actionable_after_membership_loss(
    client: TestClient, tmp_path: Path
) -> None:
    owner, member, group_id, item = shared_reservation_fixture(
        client,
        "stale-membership-owner@example.com",
        "stale-membership-member@example.com",
    )
    reservation = request_pending_reservation(client, member, group_id, item["id"])
    remove_membership_without_closing_pending(tmp_path, group_id, member.user_id)

    owner_headers = use_session(client, owner)
    accept = client.post(
        f"/api/reservations/{reservation['id']}/accept", headers=owner_headers
    )

    assert accept.status_code == 200
    assert accept.json()["reservation"]["status"] == "accepted"


def test_global_shared_items_deduplicate_and_show_visibility_context(
    client: TestClient,
) -> None:
    owner = register_user(client, "global-owner@example.com")
    member_email = "global-member@example.com"
    member = register_user(client, member_email)
    first_group_id = create_group_and_invite_member(client, owner, member, member_email)
    second_group_id = create_group_and_invite_member(
        client, owner, member, member_email
    )

    owner_headers = use_session(client, owner)
    location = create_location(client, owner_headers)
    item = create_item(client, owner_headers, location["id"], "Blue bin")
    upload_photo(client, owner_headers, item["id"])
    for group_id in (first_group_id, second_group_id):
        share = client.post(
            f"/api/items/{item['id']}/sharing-groups/{group_id}", headers=owner_headers
        )
        assert share.status_code == 201

    use_session(client, member)
    response = client.get("/api/shared-items")

    assert response.status_code == 200
    shared_items = response.json()["sharedItems"]
    matching = [
        shared_item for shared_item in shared_items if shared_item["id"] == item["id"]
    ]
    assert len(matching) == 1
    assert {group["id"] for group in matching[0]["visibleThrough"]} == {
        first_group_id,
        second_group_id,
    }


def test_withdraw_and_cancel_reservation_lifecycle(client: TestClient) -> None:
    owner, member, group_id, item = shared_reservation_fixture(
        client, "lifecycle-owner@example.com", "lifecycle-member@example.com"
    )
    reservation = request_pending_reservation(client, member, group_id, item["id"])

    member_headers = use_session(client, member)
    withdraw = client.post(
        f"/api/reservations/{reservation['id']}/withdraw", headers=member_headers
    )
    assert withdraw.status_code == 200
    assert withdraw.json()["reservation"]["status"] == "withdrawn"

    accepted = request_pending_reservation(
        client,
        member,
        group_id,
        item["id"],
        "2099-10-01T10:00:00",
        "2099-10-01T12:00:00",
    )
    owner_headers = use_session(client, owner)
    accept = client.post(
        f"/api/reservations/{accepted['id']}/accept", headers=owner_headers
    )
    assert accept.status_code == 200
    assert accept.json()["reservation"]["item"]["typicalPlacement"]["visible"] is True

    member_headers = use_session(client, member)
    cancel = client.post(
        f"/api/reservations/{accepted['id']}/cancel", headers=member_headers
    )
    assert cancel.status_code == 200
    cancelled = cancel.json()["reservation"]
    assert cancelled["status"] == "cancelled"
    assert cancelled["item"]["typicalPlacement"] == {"visible": False, "value": None}

    replacement = request_pending_reservation(
        client,
        member,
        group_id,
        item["id"],
        "2099-10-01T10:30:00",
        "2099-10-01T11:30:00",
    )
    assert replacement["status"] == "pending"


def test_reservation_change_proposal_requires_other_party_approval(
    client: TestClient,
) -> None:
    owner, member, group_id, item = shared_reservation_fixture(
        client, "proposal-owner@example.com", "proposal-member@example.com"
    )
    reservation = request_pending_reservation(client, member, group_id, item["id"])

    member_headers = use_session(client, member)
    proposal = client.post(
        f"/api/reservations/{reservation['id']}/change-proposals",
        headers=member_headers,
        json={"startLocal": "2099-11-01T10:00:00", "endLocal": "2099-11-01T12:00:00"},
    )
    assert proposal.status_code == 201
    change_proposal = proposal.json()["changeProposal"]
    assert change_proposal["status"] == "pending"

    duplicate = client.post(
        f"/api/reservations/{reservation['id']}/change-proposals",
        headers=member_headers,
        json={"startLocal": "2099-11-02T10:00:00", "endLocal": "2099-11-02T12:00:00"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "reservation_change_proposal_pending"

    self_approval = client.post(
        f"/api/reservation-change-proposals/{change_proposal['id']}/approve",
        headers=member_headers,
    )
    assert self_approval.status_code == 409

    owner_headers = use_session(client, owner)
    approve = client.post(
        f"/api/reservation-change-proposals/{change_proposal['id']}/approve",
        headers=owner_headers,
    )
    assert approve.status_code == 200
    approved = approve.json()["changeProposal"]
    assert approved["status"] == "approved"
    assert approved["reservation"]["startLocal"] == "2099-11-01T10:00:00"

    listed = client.get(f"/api/reservations/{reservation['id']}/change-proposals")
    assert listed.status_code == 200
    assert listed.json()["changeProposals"][0]["status"] == "approved"


def test_typical_placement_snapshot_freeze_cancel_reaccept_and_change_proposal(
    client: TestClient,
) -> None:
    """Free-text Typical Placement freezes at accept; cancel hides; re-accept refreshes.

    Covers issue #12: borrower sees snapshot (not live inventory); owner edits after
    accept do not rewrite borrower reveal; date-time-only Change Proposal keeps snapshot.
    """
    owner, member, group_id, item = shared_reservation_fixture(
        client,
        "placement-snapshot-owner@example.com",
        "placement-snapshot-member@example.com",
    )
    # Fixture item has typicalPlacement "Blue bin"
    reservation = request_pending_reservation(
        client,
        member,
        group_id,
        item["id"],
        "2099-12-01T10:00:00",
        "2099-12-01T12:00:00",
    )

    # Pre-accept: borrower does not see Typical Placement (reservation + shared item)
    member_headers = use_session(client, member)
    pending = client.get(f"/api/reservations/{reservation['id']}")
    assert pending.status_code == 200
    assert pending.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": False,
        "value": None,
    }
    shared_pending = client.get(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}"
    )
    assert shared_pending.status_code == 200
    assert shared_pending.json()["sharedItem"]["typicalPlacement"] == {
        "visible": False,
        "value": None,
    }

    owner_headers = use_session(client, owner)
    accepted = client.post(
        f"/api/reservations/{reservation['id']}/accept", headers=owner_headers
    )
    assert accepted.status_code == 200
    # Owner still sees live placement on accept response
    assert accepted.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }

    member_headers = use_session(client, member)
    frozen = client.get(f"/api/reservations/{reservation['id']}")
    assert frozen.status_code == 200
    assert frozen.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }
    shared_accepted = client.get(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}"
    )
    assert shared_accepted.json()["sharedItem"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }

    # Owner edits live free-text after accept — borrower snapshot must not rewrite
    owner_headers = use_session(client, owner)
    edited = client.patch(
        f"/api/items/{item['id']}",
        headers=owner_headers,
        json={"typicalPlacement": " Red shelf "},
    )
    assert edited.status_code == 200
    assert edited.json()["item"]["typicalPlacement"] == "Red shelf"

    member_headers = use_session(client, member)
    still_frozen = client.get(f"/api/reservations/{reservation['id']}")
    assert still_frozen.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }
    shared_still_frozen = client.get(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}"
    )
    assert shared_still_frozen.json()["sharedItem"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }

    # Owner viewing the same reservation still sees live placement
    owner_headers = use_session(client, owner)
    owner_view = client.get(f"/api/reservations/{reservation['id']}")
    assert owner_view.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Red shelf",
    }

    # Approving a date-time-only Change Proposal must not re-snapshot placement
    member_headers = use_session(client, member)
    proposal = client.post(
        f"/api/reservations/{reservation['id']}/change-proposals",
        headers=member_headers,
        json={
            "startLocal": "2099-12-02T10:00:00",
            "endLocal": "2099-12-02T12:00:00",
        },
    )
    assert proposal.status_code == 201
    change_proposal_id = proposal.json()["changeProposal"]["id"]

    owner_headers = use_session(client, owner)
    approve = client.post(
        f"/api/reservation-change-proposals/{change_proposal_id}/approve",
        headers=owner_headers,
    )
    assert approve.status_code == 200
    assert approve.json()["changeProposal"]["reservation"]["startLocal"] == (
        "2099-12-02T10:00:00"
    )

    member_headers = use_session(client, member)
    after_proposal = client.get(f"/api/reservations/{reservation['id']}")
    assert after_proposal.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Blue bin",
    }
    assert after_proposal.json()["reservation"]["startLocal"] == "2099-12-02T10:00:00"

    # Cancel hides Typical Placement from the borrower again
    cancel = client.post(
        f"/api/reservations/{reservation['id']}/cancel", headers=member_headers
    )
    assert cancel.status_code == 200
    assert cancel.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": False,
        "value": None,
    }
    shared_cancelled = client.get(
        f"/api/sharing-groups/{group_id}/shared-items/{item['id']}"
    )
    assert shared_cancelled.json()["sharedItem"]["typicalPlacement"] == {
        "visible": False,
        "value": None,
    }

    # Re-accept a *new* pending Reservation captures a fresh snapshot from live text
    owner_headers = use_session(client, owner)
    clear_placement = client.patch(
        f"/api/items/{item['id']}",
        headers=owner_headers,
        json={"typicalPlacement": "  Garage loft  "},
    )
    assert clear_placement.status_code == 200
    assert clear_placement.json()["item"]["typicalPlacement"] == "Garage loft"

    re_request = request_pending_reservation(
        client,
        member,
        group_id,
        item["id"],
        "2099-12-10T10:00:00",
        "2099-12-10T12:00:00",
    )
    member_headers = use_session(client, member)
    re_pending = client.get(f"/api/reservations/{re_request['id']}")
    assert re_pending.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": False,
        "value": None,
    }

    owner_headers = use_session(client, owner)
    re_accept = client.post(
        f"/api/reservations/{re_request['id']}/accept", headers=owner_headers
    )
    assert re_accept.status_code == 200

    member_headers = use_session(client, member)
    re_frozen = client.get(f"/api/reservations/{re_request['id']}")
    assert re_frozen.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": "Garage loft",
    }


def test_typical_placement_snapshot_freezes_empty_when_none_set(
    client: TestClient,
) -> None:
    owner = register_user(client, "empty-placement-owner@example.com")
    member = register_user(client, "empty-placement-member@example.com")
    group_id = create_group_and_invite_member(
        client, owner, member, "empty-placement-member@example.com"
    )

    owner_headers = use_session(client, owner)
    location = create_location(client, owner_headers)
    # No typicalPlacement on create → empty freeze
    item = create_item(client, owner_headers, location["id"])
    assert item.get("typicalPlacement") is None
    share = client.post(
        f"/api/items/{item['id']}/sharing-groups/{group_id}", headers=owner_headers
    )
    assert share.status_code == 201

    reservation = request_pending_reservation(
        client,
        member,
        group_id,
        item["id"],
        "2099-12-20T10:00:00",
        "2099-12-20T12:00:00",
    )
    owner_headers = use_session(client, owner)
    accepted = client.post(
        f"/api/reservations/{reservation['id']}/accept", headers=owner_headers
    )
    assert accepted.status_code == 200

    use_session(client, member)
    frozen = client.get(f"/api/reservations/{reservation['id']}")
    assert frozen.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": None,
    }

    # Live owner edit after empty freeze still must not leak to borrower
    owner_headers = use_session(client, owner)
    edited = client.patch(
        f"/api/items/{item['id']}",
        headers=owner_headers,
        json={"typicalPlacement": "Now filled in"},
    )
    assert edited.status_code == 200

    use_session(client, member)
    still_empty = client.get(f"/api/reservations/{reservation['id']}")
    assert still_empty.json()["reservation"]["item"]["typicalPlacement"] == {
        "visible": True,
        "value": None,
    }
    shared = client.get(f"/api/sharing-groups/{group_id}/shared-items/{item['id']}")
    assert shared.json()["sharedItem"]["typicalPlacement"] == {
        "visible": True,
        "value": None,
    }
