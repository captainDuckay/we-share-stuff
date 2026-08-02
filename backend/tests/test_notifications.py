from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID, uuid4

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
