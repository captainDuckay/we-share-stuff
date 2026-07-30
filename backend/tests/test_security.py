import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings

PASSWORD = "a secure password"


def test_unapproved_origin_is_rejected(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/auth/register",
        headers={
            "Origin": "https://attacker.example",
            "X-XSRF-TOKEN": csrf_headers["X-XSRF-TOKEN"],
        },
        json={
            "email": "person@example.com",
            "password": PASSWORD,
            "displayName": "Person",
        },
    )
    assert response.status_code == 403
    assert response.json()["code"] == "origin_not_allowed"


def test_cors_preflight_uses_exact_origin(client: TestClient) -> None:
    response = client.options(
        "/api/items",
        headers={
            "Origin": "http://localhost:4200",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_wildcard_frontend_origins_are_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(frontend_origins="*")


def test_production_environment_requires_secure_cookies() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="Production", cookie_secure=False)


def test_malformed_credential_email_returns_validation_problem(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/auth/sign-in",
        headers=csrf_headers,
        json={"email": None, "password": PASSWORD},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"
