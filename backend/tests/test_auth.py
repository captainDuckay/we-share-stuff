from fastapi.testclient import TestClient

PASSWORD = "a secure password"
DISPLAY_NAME = "Person"


def register(
    client: TestClient, headers: dict[str, str], email: str = "person@example.com"
):
    return client.post(
        "/api/auth/register",
        headers=headers,
        json={"email": email, "password": PASSWORD, "displayName": DISPLAY_NAME},
    )


def test_register_restores_and_signs_out(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    registered = register(client, csrf_headers)

    assert registered.status_code == 201
    assert registered.json()["user"] == {
        "id": registered.json()["user"]["id"],
        "email": "person@example.com",
        "displayName": DISPLAY_NAME,
        "profilePhotoUrl": None,
    }
    assert "httponly" in registered.headers["set-cookie"].lower()

    session = client.get("/api/auth/session")
    assert session.status_code == 200
    assert session.headers["cache-control"] == "no-store"

    token = client.cookies.get("XSRF-TOKEN")
    signed_out = client.post(
        "/api/auth/sign-out",
        headers={"Origin": "http://localhost:4200", "X-XSRF-TOKEN": token},
    )
    assert signed_out.status_code == 204
    assert client.get("/api/auth/session").status_code == 401
    assert client.cookies.get("XSRF-TOKEN")


def test_registration_does_not_disclose_existing_email(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    assert register(client, csrf_headers).status_code == 201
    repeated = register(
        client,
        {
            "Origin": "http://localhost:4200",
            "X-XSRF-TOKEN": client.cookies.get("XSRF-TOKEN"),
        },
    )

    assert repeated.status_code == 400
    assert repeated.json()["code"] == "registration_failed"


def test_sign_in_failure_and_rotation(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    assert register(client, csrf_headers).status_code == 201
    old_session = client.cookies.get("wss_session")
    client.cookies.clear()
    client.get("/api/auth/session")
    fresh_headers = {
        "Origin": "http://localhost:4200",
        "X-XSRF-TOKEN": client.cookies.get("XSRF-TOKEN"),
    }
    failed = client.post(
        "/api/auth/sign-in",
        headers=fresh_headers,
        json={"email": "person@example.com", "password": PASSWORD + "!"},
    )
    assert failed.status_code == 401
    assert failed.json()["code"] == "invalid_credentials"

    client.get("/api/auth/session")
    token = client.cookies.get("XSRF-TOKEN")
    signed_in = client.post(
        "/api/auth/sign-in",
        headers={"Origin": "http://localhost:4200", "X-XSRF-TOKEN": token},
        json={"email": "person@example.com", "password": PASSWORD},
    )
    assert signed_in.status_code == 200
    assert client.cookies.get("wss_session") != old_session


def test_auth_requires_matching_csrf(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "person@example.com",
            "password": PASSWORD,
            "displayName": DISPLAY_NAME,
        },
    )
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_invalid"
