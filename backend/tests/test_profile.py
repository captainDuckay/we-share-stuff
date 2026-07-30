from dataclasses import dataclass

from fastapi.testclient import TestClient

PASSWORD = "a secure password"
ORIGIN = "http://localhost:4200"
PNG_IMAGE = b"\x89PNG\r\n\x1a\nprofile image"
WEBP_IMAGE = b"RIFF\x00\x00\x00\x00WEBPowner image"


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


def test_profile_update_photo_lifecycle_and_unrelated_privacy(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    owner = register_user(client, "owner@example.com", "Owner")
    owner_headers = use_session(client, owner)

    updated = client.patch(
        "/api/profile", headers=owner_headers, json={"displayName": " Ada Lovelace "}
    )
    assert updated.status_code == 200
    assert updated.json()["user"]["displayName"] == "Ada Lovelace"

    invalid = client.post(
        "/api/profile/photo",
        headers=owner_headers,
        files={"file": ("profile.png", b"not an image", "image/png")},
    )
    assert invalid.status_code == 415
    assert invalid.json()["code"] == "profile_photo_invalid_image"

    uploaded = client.post(
        "/api/profile/photo",
        headers=owner_headers,
        files={"file": ("profile.png", PNG_IMAGE, "image/png")},
    )
    assert uploaded.status_code == 200
    photo_url = uploaded.json()["user"]["profilePhotoUrl"]
    assert photo_url == f"/api/profile-photos/{owner.user_id}/content"
    photo_response = client.get(photo_url)
    assert photo_response.content == PNG_IMAGE
    assert photo_response.headers["x-content-type-options"] == "nosniff"

    unrelated = register_user(client, "unrelated@example.com", "Unrelated")
    use_session(client, unrelated)
    assert client.get(photo_url).status_code == 404

    owner_headers = use_session(client, owner)
    removed = client.delete("/api/profile/photo", headers=owner_headers)
    assert removed.status_code == 204
    assert client.get(photo_url).status_code == 404


def test_common_group_members_receive_private_profile_identity_not_email(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    owner = register_user(client, "owner@example.com", "Owner Person")
    owner_headers = use_session(client, owner)
    group = client.post(
        "/api/sharing-groups", headers=owner_headers, json={"name": "Friends"}
    ).json()["sharingGroup"]
    invitation = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=owner_headers,
        json={"email": "member@example.com"},
    )
    assert invitation.status_code == 201

    member = register_user(client, "member@example.com", "Member Person")
    member_headers = use_session(client, member)
    invitations = client.get("/api/invitations").json()["invitations"]
    accepted = client.post(
        f"/api/invitations/{invitations[0]['id']}/accept", headers=member_headers
    )
    assert accepted.status_code == 200

    owner_headers = use_session(client, owner)
    uploaded = client.post(
        "/api/profile/photo",
        headers=owner_headers,
        files={"file": ("profile.webp", WEBP_IMAGE, "image/webp")},
    )
    photo_url = uploaded.json()["user"]["profilePhotoUrl"]

    use_session(client, member)
    members = client.get(f"/api/sharing-groups/{group['id']}/members")
    assert members.status_code == 200
    owner_summary = next(
        entry["user"]
        for entry in members.json()["members"]
        if entry["user"]["id"] == owner.user_id
    )
    assert owner_summary == {
        "id": owner.user_id,
        "displayName": "Owner Person",
        "profilePhotoUrl": photo_url,
    }
    assert client.get(photo_url).status_code == 200

    owner_headers = use_session(client, owner)
    location = client.post(
        "/api/typical-locations",
        headers=owner_headers,
        json={
            "name": "Home",
            "details": None,
            "timezone": "Europe/Copenhagen",
        },
    ).json()["typicalLocation"]
    item = client.post(
        "/api/items",
        headers=owner_headers,
        json={"name": "Tent", "typicalLocationId": location["id"]},
    ).json()["item"]
    item_photo = client.post(
        f"/api/items/{item['id']}/photos",
        headers=owner_headers,
        files={"file": ("item.png", PNG_IMAGE, "image/png")},
    )
    assert item_photo.status_code == 201
    shared = client.post(
        f"/api/items/{item['id']}/sharing-groups/{group['id']}",
        headers=owner_headers,
    )
    assert shared.status_code == 201

    member_headers = use_session(client, member)
    reservation = client.post(
        f"/api/sharing-groups/{group['id']}/shared-items/{item['id']}/reservations",
        headers=member_headers,
        json={"startLocal": "2099-08-01T10:00", "endLocal": "2099-08-01T12:00"},
    )
    assert reservation.status_code == 201

    owner_headers = use_session(client, owner)
    removed = client.delete(
        f"/api/sharing-groups/{group['id']}/members/{member.user_id}",
        headers=owner_headers,
    )
    assert removed.status_code == 204

    use_session(client, member)
    assert client.get(photo_url).status_code == 200
