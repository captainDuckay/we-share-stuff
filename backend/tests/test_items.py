from fastapi.testclient import TestClient

PASSWORD = "a secure password"
DISPLAY_NAME = "Person"


def authenticated_client(
    client: TestClient, csrf_headers: dict[str, str]
) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        headers=csrf_headers,
        json={
            "email": "person@example.com",
            "password": PASSWORD,
            "displayName": DISPLAY_NAME,
        },
    )
    assert response.status_code == 201
    return {
        "Origin": "http://localhost:4200",
        "X-XSRF-TOKEN": client.cookies.get("XSRF-TOKEN"),
    }


def test_item_crud_and_description_patch(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    headers = authenticated_client(client, csrf_headers)
    created = client.post(
        "/api/items",
        headers=headers,
        json={"name": "  Tent  ", "description": "  Two person  "},
    )
    assert created.status_code == 201
    item = created.json()["item"]
    assert item["name"] == "Tent"
    assert item["description"] == "Two person"
    assert item["photoUrl"] is None
    assert "visual" not in item

    updated = client.patch(
        f"/api/items/{item['id']}", headers=headers, json={"description": None}
    )
    assert updated.status_code == 200
    assert updated.json()["item"]["description"] is None

    listed = client.get("/api/items")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1
    deleted = client.delete(f"/api/items/{item['id']}", headers=headers)
    assert deleted.status_code == 204


def test_item_owner_isolation(client: TestClient, csrf_headers: dict[str, str]) -> None:
    first_headers = authenticated_client(client, csrf_headers)
    created = client.post(
        "/api/items", headers=first_headers, json={"name": "Private item"}
    )
    item_id = created.json()["item"]["id"]

    client.cookies.clear()
    client.get("/api/auth/session")
    token = client.cookies.get("XSRF-TOKEN")
    second_headers = {"Origin": "http://localhost:4200", "X-XSRF-TOKEN": token}
    response = client.post(
        "/api/auth/register",
        headers=second_headers,
        json={
            "email": "other@example.com",
            "password": PASSWORD,
            "displayName": "Other Person",
        },
    )
    assert response.status_code == 201
    second_headers["X-XSRF-TOKEN"] = client.cookies.get("XSRF-TOKEN")

    forbidden = client.patch(
        f"/api/items/{item_id}", headers=second_headers, json={"name": "Stolen"}
    )
    assert forbidden.status_code == 404
    assert forbidden.json()["code"] == "item_not_found"


def test_item_validation_is_problem_json(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    headers = authenticated_client(client, csrf_headers)
    response = client.post("/api/items", headers=headers, json={"name": "   "})
    assert response.status_code == 400
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "validation_failed"

    visual_icon = client.post(
        "/api/items",
        headers=headers,
        json={"name": "Tent", "visualIcon": "camping"},
    )
    assert visual_icon.status_code == 400
    assert visual_icon.json()["code"] == "validation_failed"


def test_item_patch_accepts_and_replaces_categories(
    client: TestClient, csrf_headers: dict[str, str]
) -> None:
    """Owned-item editor always PATCHes categories with the rest of the form."""
    headers = authenticated_client(client, csrf_headers)
    created = client.post(
        "/api/items",
        headers=headers,
        json={"name": "Cordless drill", "categories": ["garden", "power tool"]},
    )
    assert created.status_code == 201
    item_id = created.json()["item"]["id"]
    assert {c["name"] for c in created.json()["item"]["categories"]} == {
        "garden",
        "power tool",
    }

    updated = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={
            "name": "Cordless drill",
            "description": "test",
            "typicalPlacement": None,
            "categories": ["power tool"],
        },
    )
    assert updated.status_code == 200, updated.json()
    names = [c["name"] for c in updated.json()["item"]["categories"]]
    assert names == ["power tool"]

    cleared = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"categories": []},
    )
    assert cleared.status_code == 200
    assert cleared.json()["item"]["categories"] == []
