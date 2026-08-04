from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.models import Notification
from app.security import now_utc

PASSWORD = "a secure password"
ORIGIN = "http://localhost:4200"


@dataclass(frozen=True)
class ApiSession:
    user_id: str
    cookies: dict[str, str]
    headers: dict[str, str]


def register_user(client: TestClient, email: str, display_name: str) -> ApiSession:
    client.cookies.clear()
    client.get("/api/auth/session")
    token = client.cookies.get("XSRF-TOKEN")
    response = client.post(
        "/api/auth/register",
        headers={"Origin": ORIGIN, "X-XSRF-TOKEN": token},
        json={
            "email": email,
            "password": PASSWORD,
            "displayName": display_name,
        },
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


def make_notification(
    *,
    recipient_user_id: str | UUID,
    kind: str = "invitation",
    subject_id: UUID | None = None,
    subject_status: str = "pending",
    attention: str = "unread",
    summary: str = "You're invited",
    deep_link: dict | None = None,
    payload: dict | None = None,
    created_at=None,
    updated_at=None,
) -> Notification:
    now = now_utc()
    return Notification(
        id=uuid4(),
        recipient_user_id=UUID(str(recipient_user_id)),
        kind=kind,
        subject_id=subject_id or uuid4(),
        subject_status=subject_status,
        attention=attention,
        summary=summary,
        deep_link=deep_link or {"surface": "home"},
        payload=payload or {},
        created_at=created_at or now,
        updated_at=updated_at or now,
    )


def test_notifications_require_authentication(client: TestClient) -> None:
    client.cookies.clear()
    assert client.get("/api/notifications").status_code == 401
    assert client.get("/api/notifications/unread-count").status_code == 401
    assert (
        client.post(f"/api/notifications/{uuid4()}/read").status_code == 401
    )


def test_empty_inbox_list_and_count(client: TestClient) -> None:
    user = register_user(client, "empty@example.com", "Empty")
    headers = use_session(client, user)

    listed = client.get("/api/notifications", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body == {
        "notifications": [],
        "unreadCount": 0,
        "limit": 20,
        "offset": 0,
        "total": 0,
    }

    count = client.get("/api/notifications/unread-count", headers=headers)
    assert count.status_code == 200
    assert count.json() == {"unreadCount": 0}


def test_list_isolates_users_sorts_and_paginates(
    client: TestClient, seed_models: Callable[..., None]
) -> None:
    alice = register_user(client, "alice@example.com", "Alice")
    bob = register_user(client, "bob@example.com", "Bob")
    now = now_utc()

    older = make_notification(
        recipient_user_id=alice.user_id,
        summary="Older invite",
        updated_at=now - timedelta(hours=2),
        created_at=now - timedelta(hours=2),
    )
    newer = make_notification(
        recipient_user_id=alice.user_id,
        kind="reservation_request",
        summary="Newer request",
        attention="read",
        updated_at=now - timedelta(minutes=5),
        created_at=now - timedelta(hours=1),
        deep_link={"surface": "reservations", "reservationId": str(uuid4())},
    )
    middle = make_notification(
        recipient_user_id=alice.user_id,
        kind="reservation_change_proposal",
        summary="Middle proposal",
        updated_at=now - timedelta(hours=1),
        created_at=now - timedelta(hours=1),
    )
    bob_only = make_notification(
        recipient_user_id=bob.user_id,
        summary="Bob's invite",
        updated_at=now,
    )
    seed_models(older, newer, middle, bob_only)

    headers = use_session(client, alice)
    listed = client.get("/api/notifications", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 3
    assert body["unreadCount"] == 2
    assert [row["summary"] for row in body["notifications"]] == [
        "Newer request",
        "Middle proposal",
        "Older invite",
    ]
    assert all(row["id"] != str(bob_only.id) for row in body["notifications"])

    page = client.get(
        "/api/notifications",
        headers=headers,
        params={"limit": 1, "offset": 1},
    )
    assert page.status_code == 200
    page_body = page.json()
    assert page_body["limit"] == 1
    assert page_body["offset"] == 1
    assert page_body["total"] == 3
    assert len(page_body["notifications"]) == 1
    assert page_body["notifications"][0]["summary"] == "Middle proposal"

    bob_headers = use_session(client, bob)
    bob_list = client.get("/api/notifications", headers=bob_headers)
    assert bob_list.status_code == 200
    bob_body = bob_list.json()
    assert bob_body["total"] == 1
    assert bob_body["notifications"][0]["summary"] == "Bob's invite"


def test_unread_count_matches_unread_rows(
    client: TestClient, seed_models: Callable[..., None]
) -> None:
    user = register_user(client, "count@example.com", "Count")
    seed_models(
        make_notification(recipient_user_id=user.user_id, attention="unread"),
        make_notification(recipient_user_id=user.user_id, attention="unread"),
        make_notification(recipient_user_id=user.user_id, attention="read"),
    )
    headers = use_session(client, user)
    count = client.get("/api/notifications/unread-count", headers=headers)
    assert count.status_code == 200
    assert count.json() == {"unreadCount": 2}


def test_mark_read_idempotent_and_isolates_other_user(
    client: TestClient, seed_models: Callable[..., None]
) -> None:
    alice = register_user(client, "read-alice@example.com", "Alice")
    bob = register_user(client, "read-bob@example.com", "Bob")
    alice_row = make_notification(
        recipient_user_id=alice.user_id,
        attention="unread",
        summary="Alice notice",
    )
    bob_row = make_notification(
        recipient_user_id=bob.user_id,
        attention="unread",
        summary="Bob notice",
    )
    seed_models(alice_row, bob_row)

    headers = use_session(client, alice)
    first = client.post(
        f"/api/notifications/{alice_row.id}/read", headers=headers
    )
    assert first.status_code == 200
    first_body = first.json()["notification"]
    assert first_body["attention"] == "read"
    assert first_body["id"] == str(alice_row.id)

    count = client.get("/api/notifications/unread-count", headers=headers)
    assert count.json() == {"unreadCount": 0}

    second = client.post(
        f"/api/notifications/{alice_row.id}/read", headers=headers
    )
    assert second.status_code == 200
    assert second.json()["notification"]["attention"] == "read"

    foreign = client.post(
        f"/api/notifications/{bob_row.id}/read", headers=headers
    )
    assert foreign.status_code == 404
    assert foreign.json()["code"] == "notification_not_found"

    missing = client.post(f"/api/notifications/{uuid4()}/read", headers=headers)
    assert missing.status_code == 404

    bob_headers = use_session(client, bob)
    bob_count = client.get("/api/notifications/unread-count", headers=bob_headers)
    assert bob_count.json() == {"unreadCount": 1}


def test_list_item_shape_includes_payload_and_deep_link(
    client: TestClient, seed_models: Callable[..., None]
) -> None:
    user = register_user(client, "shape@example.com", "Shape")
    group_id = uuid4()
    row = make_notification(
        recipient_user_id=user.user_id,
        kind="invitation",
        subject_status="pending",
        summary="Join Backyard Tools",
        deep_link={"surface": "sharing_group", "sharingGroupId": str(group_id)},
        payload={
            "sharingGroupId": str(group_id),
            "sharingGroupName": "Backyard Tools",
            "inviterDisplayName": "Ada",
        },
    )
    seed_models(row)
    headers = use_session(client, user)
    listed = client.get("/api/notifications", headers=headers)
    assert listed.status_code == 200
    item = listed.json()["notifications"][0]
    assert item["kind"] == "invitation"
    assert item["subjectId"] == str(row.subject_id)
    assert item["subjectStatus"] == "pending"
    assert item["attention"] == "unread"
    assert item["summary"] == "Join Backyard Tools"
    assert item["deepLink"]["surface"] == "sharing_group"
    assert item["deepLink"]["sharingGroupId"] == str(group_id)
    assert item["payload"]["sharingGroupName"] == "Backyard Tools"
    assert "createdAt" in item
    assert "updatedAt" in item


def _create_group(client: TestClient, headers: dict[str, str], name: str = "Friends") -> dict:
    response = client.post(
        "/api/sharing-groups", headers=headers, json={"name": name}
    )
    assert response.status_code == 201
    return response.json()["sharingGroup"]


def test_invitation_create_notifies_invitee_only_not_inviter(
    client: TestClient,
) -> None:
    inviter = register_user(client, "inviter@example.com", "Inviter")
    invitee = register_user(client, "invitee@example.com", "Invitee")
    inviter_headers = use_session(client, inviter)
    group = _create_group(client, inviter_headers, "Backyard Tools")

    created = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=inviter_headers,
        json={"email": "invitee@example.com"},
    )
    assert created.status_code == 201
    invitation = created.json()["invitation"]
    invitation_id = invitation["id"]

    # Inviter gets no self-notify row.
    inviter_list = client.get("/api/notifications", headers=inviter_headers)
    assert inviter_list.status_code == 200
    assert inviter_list.json()["total"] == 0
    assert inviter_list.json()["unreadCount"] == 0

    invitee_headers = use_session(client, invitee)
    count = client.get("/api/notifications/unread-count", headers=invitee_headers)
    assert count.status_code == 200
    assert count.json() == {"unreadCount": 1}

    listed = client.get("/api/notifications", headers=invitee_headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 1
    assert body["unreadCount"] == 1
    row = body["notifications"][0]
    assert row["kind"] == "invitation"
    assert row["subjectId"] == invitation_id
    assert row["subjectStatus"] == "pending"
    assert row["attention"] == "unread"
    assert "Backyard Tools" in row["summary"]
    assert row["deepLink"]["surface"] == "home"
    assert row["payload"]["sharingGroupId"] == group["id"]
    assert row["payload"]["sharingGroupName"] == "Backyard Tools"
    assert row["payload"]["inviterDisplayName"] == "Inviter"


def test_invitation_to_unknown_email_creates_no_notification(
    client: TestClient,
) -> None:
    inviter = register_user(client, "solo-inviter@example.com", "Solo")
    headers = use_session(client, inviter)
    group = _create_group(client, headers)

    created = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=headers,
        json={"email": "nobody-yet@example.com"},
    )
    assert created.status_code == 201

    listed = client.get("/api/notifications", headers=headers)
    assert listed.json()["total"] == 0


def test_invitation_accept_updates_row_and_sets_actor_read(
    client: TestClient,
) -> None:
    inviter = register_user(client, "accept-inviter@example.com", "Ada")
    invitee = register_user(client, "accept-invitee@example.com", "Bob")
    inviter_headers = use_session(client, inviter)
    group = _create_group(client, inviter_headers, "Garden Club")

    created = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=inviter_headers,
        json={"email": "accept-invitee@example.com"},
    )
    invitation_id = created.json()["invitation"]["id"]

    invitee_headers = use_session(client, invitee)
    before = client.get("/api/notifications", headers=invitee_headers).json()
    assert before["unreadCount"] == 1
    notification_id = before["notifications"][0]["id"]

    accepted = client.post(
        f"/api/invitations/{invitation_id}/accept", headers=invitee_headers
    )
    assert accepted.status_code == 200

    after = client.get("/api/notifications", headers=invitee_headers).json()
    assert after["total"] == 1
    assert after["unreadCount"] == 0
    row = after["notifications"][0]
    assert row["id"] == notification_id
    assert row["subjectId"] == invitation_id
    assert row["subjectStatus"] == "accepted"
    assert row["attention"] == "read"
    assert row["deepLink"]["surface"] == "sharing_group"
    assert row["deepLink"]["sharingGroupId"] == group["id"]
    assert "Garden Club" in row["summary"]


def test_invitation_decline_updates_row_and_sets_actor_read(
    client: TestClient,
) -> None:
    inviter = register_user(client, "decline-inviter@example.com", "Ada")
    invitee = register_user(client, "decline-invitee@example.com", "Bob")
    inviter_headers = use_session(client, inviter)
    group = _create_group(client, inviter_headers, "Book Club")

    created = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=inviter_headers,
        json={"email": "decline-invitee@example.com"},
    )
    invitation_id = created.json()["invitation"]["id"]

    invitee_headers = use_session(client, invitee)
    declined = client.post(
        f"/api/invitations/{invitation_id}/decline", headers=invitee_headers
    )
    assert declined.status_code == 200

    after = client.get("/api/notifications", headers=invitee_headers).json()
    assert after["total"] == 1
    assert after["unreadCount"] == 0
    row = after["notifications"][0]
    assert row["subjectStatus"] == "declined"
    assert row["attention"] == "read"
    assert row["deepLink"]["surface"] == "home"


def test_invitation_cancel_by_inviter_reunread_invitee_row(
    client: TestClient,
) -> None:
    inviter = register_user(client, "cancel-inviter@example.com", "Ada")
    invitee = register_user(client, "cancel-invitee@example.com", "Bob")
    inviter_headers = use_session(client, inviter)
    group = _create_group(client, inviter_headers, "Ski Club")

    created = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=inviter_headers,
        json={"email": "cancel-invitee@example.com"},
    )
    invitation_id = created.json()["invitation"]["id"]

    invitee_headers = use_session(client, invitee)
    listed = client.get("/api/notifications", headers=invitee_headers).json()
    notification_id = listed["notifications"][0]["id"]
    # Invitee opens destination and marks Read.
    mark = client.post(
        f"/api/notifications/{notification_id}/read", headers=invitee_headers
    )
    assert mark.status_code == 200
    assert (
        client.get("/api/notifications/unread-count", headers=invitee_headers).json()[
            "unreadCount"
        ]
        == 0
    )

    inviter_headers = use_session(client, inviter)
    cancelled = client.delete(
        f"/api/sharing-groups/{group['id']}/invitations/{invitation_id}",
        headers=inviter_headers,
    )
    assert cancelled.status_code == 204

    invitee_headers = use_session(client, invitee)
    after = client.get("/api/notifications", headers=invitee_headers).json()
    assert after["total"] == 1
    assert after["unreadCount"] == 1
    row = after["notifications"][0]
    assert row["id"] == notification_id
    assert row["subjectStatus"] == "cancelled"
    assert row["attention"] == "unread"
    assert row["deepLink"]["surface"] == "home"
    assert "Ski Club" in row["summary"]

    # Inviter still has no inbox row for this invitation.
    inviter_headers = use_session(client, inviter)
    inviter_list = client.get("/api/notifications", headers=inviter_headers).json()
    assert inviter_list["total"] == 0


def test_invitation_emission_failure_rolls_back_domain_mutation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.routers.sharing_groups as sharing_groups_router

    inviter = register_user(client, "fail-inviter@example.com", "Ada")
    invitee = register_user(client, "fail-invitee@example.com", "Bob")
    inviter_headers = use_session(client, inviter)
    group = _create_group(client, inviter_headers, "Fail Club")

    async def boom(*_args, **_kwargs):
        raise RuntimeError("emission failed")

    monkeypatch.setattr(
        sharing_groups_router, "emit_invitation_notification", boom
    )

    # TestClient re-raises unhandled server errors by default.
    with pytest.raises(RuntimeError, match="emission failed"):
        client.post(
            f"/api/sharing-groups/{group['id']}/invitations",
            headers=inviter_headers,
            json={"email": "fail-invitee@example.com"},
        )

    # No pending invitation stuck without a Notification.
    inviter_headers = use_session(client, inviter)
    listed = client.get(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=inviter_headers,
        params={"status": "pending"},
    )
    assert listed.status_code == 200
    assert listed.json()["invitations"] == []

    invitee_headers = use_session(client, invitee)
    inbox = client.get("/api/notifications", headers=invitee_headers).json()
    assert inbox["total"] == 0


# --- Reservation Request emission (kind catalog matrix) ---


def _create_location(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/typical-locations",
        headers=headers,
        json={
            "name": "Home",
            "details": "Main Street 1",
            "timezone": "Europe/Copenhagen",
        },
    )
    assert response.status_code == 201
    return response.json()["typicalLocation"]


def _create_item(
    client: TestClient, headers: dict[str, str], location_id: str
) -> dict:
    response = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Tent",
            "description": "Two person",
            "typicalLocationId": location_id,
            "typicalPlacement": "Garage",
        },
    )
    assert response.status_code == 201
    return response.json()["item"]


def _shared_reservation_setup(
    client: TestClient,
    owner_email: str,
    requester_email: str,
    owner_name: str = "Owner",
    requester_name: str = "Requester",
) -> tuple[ApiSession, ApiSession, str, dict]:
    owner = register_user(client, owner_email, owner_name)
    requester = register_user(client, requester_email, requester_name)
    owner_headers = use_session(client, owner)
    group = _create_group(client, owner_headers, "Trail Club")
    invite = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=owner_headers,
        json={"email": requester_email},
    )
    assert invite.status_code == 201
    invitation_id = invite.json()["invitation"]["id"]
    requester_headers = use_session(client, requester)
    accepted = client.post(
        f"/api/invitations/{invitation_id}/accept", headers=requester_headers
    )
    assert accepted.status_code == 200
    owner_headers = use_session(client, owner)
    location = _create_location(client, owner_headers)
    item = _create_item(client, owner_headers, location["id"])
    share = client.post(
        f"/api/items/{item['id']}/sharing-groups/{group['id']}",
        headers=owner_headers,
    )
    assert share.status_code == 201
    return owner, requester, group["id"], item


def _request_reservation(
    client: TestClient,
    requester: ApiSession,
    group_id: str,
    item_id: str,
    *,
    start_local: str = "2099-09-01T10:00:00",
    end_local: str = "2099-09-01T12:00:00",
) -> dict:
    headers = use_session(client, requester)
    response = client.post(
        f"/api/sharing-groups/{group_id}/shared-items/{item_id}/reservations",
        headers=headers,
        json={"startLocal": start_local, "endLocal": end_local},
    )
    assert response.status_code == 201
    return response.json()["reservation"]


def test_reservation_create_notifies_owner_only_not_requester(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-create-owner@example.com",
        "rr-create-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])

    owner_headers = use_session(client, owner)
    owner_inbox = client.get("/api/notifications", headers=owner_headers).json()
    # Invitation accepted may leave owner with no invitation row; only RR counts.
    rr_rows = [
        row
        for row in owner_inbox["notifications"]
        if row["kind"] == "reservation_request"
    ]
    assert len(rr_rows) == 1
    row = rr_rows[0]
    assert row["subjectId"] == reservation["id"]
    assert row["subjectStatus"] == "pending"
    assert row["attention"] == "unread"
    assert "Tent" in row["summary"]
    assert "Bob" in row["summary"]
    assert row["deepLink"]["surface"] == "reservations"
    assert row["deepLink"]["reservationId"] == reservation["id"]
    assert row["payload"]["itemName"] == "Tent"
    assert row["payload"]["otherPartyDisplayName"] == "Bob"
    assert row["payload"]["timezone"] == "Europe/Copenhagen"
    assert owner_inbox["unreadCount"] >= 1

    requester_headers = use_session(client, requester)
    requester_inbox = client.get("/api/notifications", headers=requester_headers).json()
    rr_for_requester = [
        row
        for row in requester_inbox["notifications"]
        if row["kind"] == "reservation_request"
    ]
    assert rr_for_requester == []


def test_reservation_accept_updates_owner_read_and_creates_requester_unread(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-accept-owner@example.com",
        "rr-accept-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    reservation_id = reservation["id"]

    owner_headers = use_session(client, owner)
    before = client.get("/api/notifications", headers=owner_headers).json()
    owner_row_id = next(
        row["id"]
        for row in before["notifications"]
        if row["kind"] == "reservation_request"
    )

    accepted = client.post(
        f"/api/reservations/{reservation_id}/accept", headers=owner_headers
    )
    assert accepted.status_code == 200

    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rr = next(
        row
        for row in owner_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    assert owner_rr["id"] == owner_row_id
    assert owner_rr["subjectStatus"] == "accepted"
    assert owner_rr["attention"] == "read"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    requester_rr = next(
        row
        for row in requester_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    assert requester_rr["subjectId"] == reservation_id
    assert requester_rr["subjectStatus"] == "accepted"
    assert requester_rr["attention"] == "unread"
    assert "Ada" in requester_rr["summary"]
    assert requester_rr["deepLink"]["surface"] == "reservations"


def test_reservation_decline_updates_owner_and_creates_requester(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-decline-owner@example.com",
        "rr-decline-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    reservation_id = reservation["id"]

    owner_headers = use_session(client, owner)
    declined = client.post(
        f"/api/reservations/{reservation_id}/decline", headers=owner_headers
    )
    assert declined.status_code == 200

    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rr = next(
        row
        for row in owner_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    assert owner_rr["subjectStatus"] == "declined"
    assert owner_rr["attention"] == "read"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    requester_rr = next(
        row
        for row in requester_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    assert requester_rr["subjectStatus"] == "declined"
    assert requester_rr["attention"] == "unread"


def test_reservation_withdraw_updates_owner_reunread_no_requester_row(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-withdraw-owner@example.com",
        "rr-withdraw-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    reservation_id = reservation["id"]

    owner_headers = use_session(client, owner)
    listed = client.get("/api/notifications", headers=owner_headers).json()
    notification_id = next(
        row["id"]
        for row in listed["notifications"]
        if row["kind"] == "reservation_request"
    )
    mark = client.post(
        f"/api/notifications/{notification_id}/read", headers=owner_headers
    )
    assert mark.status_code == 200
    assert (
        client.get("/api/notifications/unread-count", headers=owner_headers).json()[
            "unreadCount"
        ]
        == 0
    )

    requester_headers = use_session(client, requester)
    withdrawn = client.post(
        f"/api/reservations/{reservation_id}/withdraw", headers=requester_headers
    )
    assert withdrawn.status_code == 200

    owner_headers = use_session(client, owner)
    after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rr = next(
        row for row in after["notifications"] if row["kind"] == "reservation_request"
    )
    assert owner_rr["id"] == notification_id
    assert owner_rr["subjectStatus"] == "withdrawn"
    assert owner_rr["attention"] == "unread"
    assert "Bob" in owner_rr["summary"]

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    assert [
        row
        for row in requester_after["notifications"]
        if row["kind"] == "reservation_request"
    ] == []


def test_reservation_cancel_by_owner_creates_requester_row_and_reads_actor(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-cancel-owner@example.com",
        "rr-cancel-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    reservation_id = reservation["id"]
    owner_headers = use_session(client, owner)
    accepted = client.post(
        f"/api/reservations/{reservation_id}/accept", headers=owner_headers
    )
    assert accepted.status_code == 200

    cancelled = client.post(
        f"/api/reservations/{reservation_id}/cancel", headers=owner_headers
    )
    assert cancelled.status_code == 200

    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rr = next(
        row
        for row in owner_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    assert owner_rr["subjectStatus"] == "cancelled"
    assert owner_rr["attention"] == "read"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    requester_rr = next(
        row
        for row in requester_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    assert requester_rr["subjectStatus"] == "cancelled"
    assert requester_rr["attention"] == "unread"


def test_reservation_cancel_by_requester_notifies_owner(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-cancel-req-owner@example.com",
        "rr-cancel-req-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    reservation_id = reservation["id"]
    owner_headers = use_session(client, owner)
    accepted = client.post(
        f"/api/reservations/{reservation_id}/accept", headers=owner_headers
    )
    assert accepted.status_code == 200

    # Owner marks Read after accept (own action already Read; mark is idempotent).
    owner_list = client.get("/api/notifications", headers=owner_headers).json()
    owner_rr_id = next(
        row["id"]
        for row in owner_list["notifications"]
        if row["kind"] == "reservation_request"
    )

    requester_headers = use_session(client, requester)
    cancelled = client.post(
        f"/api/reservations/{reservation_id}/cancel", headers=requester_headers
    )
    assert cancelled.status_code == 200

    owner_headers = use_session(client, owner)
    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rr = next(
        row
        for row in owner_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    assert owner_rr["id"] == owner_rr_id
    assert owner_rr["subjectStatus"] == "cancelled"
    assert owner_rr["attention"] == "unread"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    requester_rr = next(
        row
        for row in requester_after["notifications"]
        if row["kind"] == "reservation_request"
    )
    # Requester already had a row from accept; cancel as actor sets Read.
    assert requester_rr["subjectStatus"] == "cancelled"
    assert requester_rr["attention"] == "read"


def test_reservation_system_decline_on_leave_notifies_owner_not_requester(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-leave-owner@example.com",
        "rr-leave-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    reservation_id = reservation["id"]

    requester_headers = use_session(client, requester)
    left = client.delete(
        f"/api/sharing-groups/{group_id}/members/me", headers=requester_headers
    )
    assert left.status_code == 204

    owner_headers = use_session(client, owner)
    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rr = next(
        row
        for row in owner_after["notifications"]
        if row["kind"] == "reservation_request"
        and row["subjectId"] == reservation_id
    )
    assert owner_rr["subjectStatus"] == "declined"
    assert owner_rr["attention"] == "unread"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    assert [
        row
        for row in requester_after["notifications"]
        if row["kind"] == "reservation_request"
    ] == []


def test_reservation_emission_failure_rolls_back_domain_mutation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.routers.reservations as reservations_router

    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rr-fail-owner@example.com",
        "rr-fail-req@example.com",
    )

    async def boom(*_args, **_kwargs):
        raise RuntimeError("emission failed")

    monkeypatch.setattr(
        reservations_router, "emit_reservation_request_notifications", boom
    )

    requester_headers = use_session(client, requester)
    with pytest.raises(RuntimeError, match="emission failed"):
        client.post(
            f"/api/sharing-groups/{group_id}/shared-items/{item['id']}/reservations",
            headers=requester_headers,
            json={
                "startLocal": "2099-10-01T10:00:00",
                "endLocal": "2099-10-01T12:00:00",
            },
        )

    # Domain write rolled back.
    owner_headers = use_session(client, owner)
    received = client.get(
        "/api/reservations",
        headers=owner_headers,
        params={"scope": "received"},
    )
    assert received.status_code == 200
    assert received.json()["reservations"] == []

    owner_inbox = client.get("/api/notifications", headers=owner_headers).json()
    assert [
        row
        for row in owner_inbox["notifications"]
        if row["kind"] == "reservation_request"
    ] == []


# --- Reservation Change Proposal emission (kind catalog matrix) ---


def _accept_reservation(
    client: TestClient, owner: ApiSession, reservation_id: str
) -> None:
    headers = use_session(client, owner)
    accepted = client.post(
        f"/api/reservations/{reservation_id}/accept", headers=headers
    )
    assert accepted.status_code == 200


def _create_change_proposal(
    client: TestClient,
    proposer: ApiSession,
    reservation_id: str,
    *,
    start_local: str = "2099-09-02T10:00:00",
    end_local: str = "2099-09-02T14:00:00",
) -> dict:
    headers = use_session(client, proposer)
    response = client.post(
        f"/api/reservations/{reservation_id}/change-proposals",
        headers=headers,
        json={"startLocal": start_local, "endLocal": end_local},
    )
    assert response.status_code == 201
    return response.json()["changeProposal"]


def _proposal_rows(inbox: dict) -> list[dict]:
    return [
        row
        for row in inbox["notifications"]
        if row["kind"] == "reservation_change_proposal"
    ]


def test_change_proposal_create_notifies_counterparty_only(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-create-owner@example.com",
        "rcp-create-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])
    proposal = _create_change_proposal(client, requester, reservation["id"])

    owner_headers = use_session(client, owner)
    owner_inbox = client.get("/api/notifications", headers=owner_headers).json()
    rcp_rows = _proposal_rows(owner_inbox)
    assert len(rcp_rows) == 1
    row = rcp_rows[0]
    assert row["subjectId"] == proposal["id"]
    assert row["subjectStatus"] == "pending"
    assert row["attention"] == "unread"
    assert "Tent" in row["summary"]
    assert "Bob" in row["summary"]
    assert row["deepLink"]["surface"] == "reservations"
    assert row["deepLink"]["reservationId"] == reservation["id"]
    assert row["payload"]["proposalId"] == proposal["id"]
    assert row["payload"]["reservationId"] == reservation["id"]
    assert row["payload"]["itemId"] == item["id"]
    assert row["payload"]["itemName"] == "Tent"
    assert row["payload"]["proposedByDisplayName"] == "Bob"
    assert row["payload"]["timezone"] == "Europe/Copenhagen"
    assert "proposedStartAt" in row["payload"]
    assert "proposedEndAt" in row["payload"]

    requester_headers = use_session(client, requester)
    requester_inbox = client.get("/api/notifications", headers=requester_headers).json()
    assert _proposal_rows(requester_inbox) == []


def test_change_proposal_approve_updates_counterparty_read_creates_proposer_unread(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-approve-owner@example.com",
        "rcp-approve-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])
    proposal = _create_change_proposal(client, requester, reservation["id"])
    proposal_id = proposal["id"]

    owner_headers = use_session(client, owner)
    before = client.get("/api/notifications", headers=owner_headers).json()
    owner_row_id = next(row["id"] for row in _proposal_rows(before))

    approved = client.post(
        f"/api/reservation-change-proposals/{proposal_id}/approve",
        headers=owner_headers,
    )
    assert approved.status_code == 200

    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rcp = next(row for row in _proposal_rows(owner_after))
    assert owner_rcp["id"] == owner_row_id
    assert owner_rcp["subjectStatus"] == "approved"
    assert owner_rcp["attention"] == "read"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    requester_rcp = next(row for row in _proposal_rows(requester_after))
    assert requester_rcp["subjectId"] == proposal_id
    assert requester_rcp["subjectStatus"] == "approved"
    assert requester_rcp["attention"] == "unread"
    assert "Tent" in requester_rcp["summary"]


def test_change_proposal_reject_updates_counterparty_and_creates_proposer(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-reject-owner@example.com",
        "rcp-reject-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])
    proposal = _create_change_proposal(client, requester, reservation["id"])
    proposal_id = proposal["id"]

    owner_headers = use_session(client, owner)
    rejected = client.post(
        f"/api/reservation-change-proposals/{proposal_id}/reject",
        headers=owner_headers,
    )
    assert rejected.status_code == 200

    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rcp = next(row for row in _proposal_rows(owner_after))
    assert owner_rcp["subjectStatus"] == "rejected"
    assert owner_rcp["attention"] == "read"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    requester_rcp = next(row for row in _proposal_rows(requester_after))
    assert requester_rcp["subjectStatus"] == "rejected"
    assert requester_rcp["attention"] == "unread"


def test_change_proposal_owner_proposes_notifies_requester(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-owner-prop-owner@example.com",
        "rcp-owner-prop-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])
    proposal = _create_change_proposal(client, owner, reservation["id"])

    requester_headers = use_session(client, requester)
    requester_inbox = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    rcp_rows = _proposal_rows(requester_inbox)
    assert len(rcp_rows) == 1
    assert rcp_rows[0]["subjectId"] == proposal["id"]
    assert rcp_rows[0]["attention"] == "unread"
    assert "Ada" in rcp_rows[0]["summary"]
    assert rcp_rows[0]["payload"]["proposedByDisplayName"] == "Ada"

    owner_headers = use_session(client, owner)
    owner_inbox = client.get("/api/notifications", headers=owner_headers).json()
    assert _proposal_rows(owner_inbox) == []


def test_change_proposal_void_on_cancel_updates_existing_no_new_for_missing(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-void-owner@example.com",
        "rcp-void-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])
    proposal = _create_change_proposal(client, requester, reservation["id"])
    proposal_id = proposal["id"]

    owner_headers = use_session(client, owner)
    listed = client.get("/api/notifications", headers=owner_headers).json()
    notification_id = next(row["id"] for row in _proposal_rows(listed))
    mark = client.post(
        f"/api/notifications/{notification_id}/read", headers=owner_headers
    )
    assert mark.status_code == 200

    # Owner cancels accepted reservation → pending proposal voided.
    cancelled = client.post(
        f"/api/reservations/{reservation['id']}/cancel", headers=owner_headers
    )
    assert cancelled.status_code == 200

    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rcp = next(row for row in _proposal_rows(owner_after))
    assert owner_rcp["id"] == notification_id
    assert owner_rcp["subjectId"] == proposal_id
    assert owner_rcp["subjectStatus"] == "void"
    # Owner is actor on cancel → own-action Read on contentful update.
    assert owner_rcp["attention"] == "read"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    # Proposer had no row at create time; void must not create a void-only row.
    assert _proposal_rows(requester_after) == []


def test_change_proposal_withdraw_voids_and_updates_counterparty(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-withdraw-owner@example.com",
        "rcp-withdraw-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])
    proposal = _create_change_proposal(client, requester, reservation["id"])
    proposal_id = proposal["id"]

    owner_headers = use_session(client, owner)
    listed = client.get("/api/notifications", headers=owner_headers).json()
    notification_id = next(row["id"] for row in _proposal_rows(listed))
    client.post(f"/api/notifications/{notification_id}/read", headers=owner_headers)

    requester_headers = use_session(client, requester)
    withdrawn = client.post(
        f"/api/reservation-change-proposals/{proposal_id}/withdraw",
        headers=requester_headers,
    )
    assert withdrawn.status_code == 200

    owner_headers = use_session(client, owner)
    after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rcp = next(row for row in _proposal_rows(after))
    assert owner_rcp["id"] == notification_id
    assert owner_rcp["subjectStatus"] == "void"
    assert owner_rcp["attention"] == "unread"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    assert _proposal_rows(requester_after) == []


def test_change_proposal_upsert_in_place_one_row_per_proposal_recipient(
    client: TestClient,
) -> None:
    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-upsert-owner@example.com",
        "rcp-upsert-req@example.com",
        owner_name="Ada",
        requester_name="Bob",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])
    proposal = _create_change_proposal(client, requester, reservation["id"])
    proposal_id = proposal["id"]

    owner_headers = use_session(client, owner)
    before = client.get("/api/notifications", headers=owner_headers).json()
    owner_row_id = next(row["id"] for row in _proposal_rows(before))

    approved = client.post(
        f"/api/reservation-change-proposals/{proposal_id}/approve",
        headers=owner_headers,
    )
    assert approved.status_code == 200

    owner_after = client.get("/api/notifications", headers=owner_headers).json()
    owner_rcps = _proposal_rows(owner_after)
    assert len(owner_rcps) == 1
    assert owner_rcps[0]["id"] == owner_row_id
    assert owner_rcps[0]["subjectStatus"] == "approved"

    requester_headers = use_session(client, requester)
    requester_after = client.get(
        "/api/notifications", headers=requester_headers
    ).json()
    assert len(_proposal_rows(requester_after)) == 1


def test_change_proposal_emission_failure_rolls_back_domain_mutation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.routers.reservations as reservations_router

    owner, requester, group_id, item = _shared_reservation_setup(
        client,
        "rcp-fail-owner@example.com",
        "rcp-fail-req@example.com",
    )
    reservation = _request_reservation(client, requester, group_id, item["id"])
    _accept_reservation(client, owner, reservation["id"])

    async def boom(*_args, **_kwargs):
        raise RuntimeError("emission failed")

    monkeypatch.setattr(
        reservations_router, "emit_reservation_change_proposal_notifications", boom
    )

    requester_headers = use_session(client, requester)
    with pytest.raises(RuntimeError, match="emission failed"):
        client.post(
            f"/api/reservations/{reservation['id']}/change-proposals",
            headers=requester_headers,
            json={
                "startLocal": "2099-11-01T10:00:00",
                "endLocal": "2099-11-01T12:00:00",
            },
        )

    owner_headers = use_session(client, owner)
    listed = client.get(
        f"/api/reservations/{reservation['id']}/change-proposals",
        headers=owner_headers,
    )
    assert listed.status_code == 200
    assert listed.json()["changeProposals"] == []

    owner_inbox = client.get("/api/notifications", headers=owner_headers).json()
    assert _proposal_rows(owner_inbox) == []
