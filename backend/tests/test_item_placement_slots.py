"""Item Typical Placement linking to Placement Slots (issue #14)."""

from dataclasses import dataclass

from fastapi.testclient import TestClient

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


def create_location(
    client: TestClient, headers: dict[str, str], name: str = "Home"
) -> dict:
    response = client.post(
        "/api/typical-locations",
        headers=headers,
        json={
            "name": name,
            "details": None,
            "timezone": "Europe/Copenhagen",
        },
    )
    assert response.status_code == 201
    return response.json()["typicalLocation"]


def create_surface_with_slot(
    client: TestClient,
    headers: dict[str, str],
    location_id: str,
    *,
    surface_name: str = "Garage wall",
    slot_label: str = "Shelf A",
) -> tuple[dict, dict]:
    surface = client.post(
        f"/api/typical-locations/{location_id}/placement-surfaces",
        headers=headers,
        json={"name": surface_name},
    ).json()["placementSurface"]
    slot = client.post(
        f"/api/typical-locations/{location_id}/placement-surfaces/{surface['id']}/slots",
        headers=headers,
        json={
            "label": slot_label,
            "x": 0,
            "y": 0,
            "width": 400,
            "height": 300,
        },
    ).json()["placementSlot"]
    return surface, slot


def test_free_text_item_has_null_slot_and_empty_placement_allowed(
    client: TestClient,
) -> None:
    owner = register_user(client, "free-text@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)

    empty = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Empty placement",
            "typicalLocationId": location["id"],
        },
    )
    assert empty.status_code == 201
    body = empty.json()["item"]
    assert body["typicalPlacement"] is None
    assert body["placementSlotId"] is None
    assert body["placementSlot"] is None

    free_text = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Legacy free text",
            "typicalLocationId": location["id"],
            "typicalPlacement": "  Blue bin top shelf  ",
        },
    )
    assert free_text.status_code == 201
    item = free_text.json()["item"]
    assert item["typicalPlacement"] == "Blue bin top shelf"
    assert item["placementSlotId"] is None
    assert item["placementSlot"] is None


def test_link_promotes_free_text_to_note_and_slot_is_primary(
    client: TestClient,
) -> None:
    owner = register_user(client, "link@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface, slot = create_surface_with_slot(client, headers, location["id"])

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Drill",
            "typicalLocationId": location["id"],
            "typicalPlacement": "behind the paint cans",
        },
    )
    assert created.status_code == 201
    item_id = created.json()["item"]["id"]

    linked = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"placementSlotId": slot["id"]},
    )
    assert linked.status_code == 200
    item = linked.json()["item"]
    assert item["placementSlotId"] == slot["id"]
    assert item["typicalPlacement"] == "behind the paint cans"
    assert item["placementSlot"]["id"] == slot["id"]
    assert item["placementSlot"]["label"] == "Shelf A"
    assert item["placementSlot"]["surfaceId"] == surface["id"]
    assert item["placementSlot"]["surfaceName"] == "Garage wall"


def test_create_item_already_linked_with_note(client: TestClient) -> None:
    owner = register_user(client, "create-linked@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot = create_surface_with_slot(client, headers, location["id"])

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Saw",
            "typicalLocationId": location["id"],
            "typicalPlacement": "left side",
            "placementSlotId": slot["id"],
        },
    )
    assert created.status_code == 201
    item = created.json()["item"]
    assert item["placementSlotId"] == slot["id"]
    assert item["typicalPlacement"] == "left side"


def test_unlink_restores_note_as_free_text(client: TestClient) -> None:
    owner = register_user(client, "unlink@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot = create_surface_with_slot(client, headers, location["id"])

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Hammer",
            "typicalLocationId": location["id"],
            "typicalPlacement": "near nails",
            "placementSlotId": slot["id"],
        },
    )
    item_id = created.json()["item"]["id"]

    unlinked = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"placementSlotId": None},
    )
    assert unlinked.status_code == 200
    item = unlinked.json()["item"]
    assert item["placementSlotId"] is None
    assert item["placementSlot"] is None
    assert item["typicalPlacement"] == "near nails"


def test_slot_to_slot_keeps_note(client: TestClient) -> None:
    owner = register_user(client, "slot-to-slot@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot_a = create_surface_with_slot(
        client, headers, location["id"], slot_label="Shelf A"
    )
    _, slot_b = create_surface_with_slot(
        client,
        headers,
        location["id"],
        surface_name="Workshop wall",
        slot_label="Shelf B",
    )

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Level",
            "typicalLocationId": location["id"],
            "typicalPlacement": "middle of the shelf",
            "placementSlotId": slot_a["id"],
        },
    )
    item_id = created.json()["item"]["id"]

    reassigned = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"placementSlotId": slot_b["id"]},
    )
    assert reassigned.status_code == 200
    item = reassigned.json()["item"]
    assert item["placementSlotId"] == slot_b["id"]
    assert item["placementSlot"]["label"] == "Shelf B"
    assert item["typicalPlacement"] == "middle of the shelf"


def test_location_change_auto_clears_slot_and_keeps_note(
    client: TestClient,
) -> None:
    owner = register_user(client, "location-clear@example.com")
    headers = use_session(client, owner)
    home = create_location(client, headers, name="Home")
    cabin = create_location(client, headers, name="Cabin")
    _, home_slot = create_surface_with_slot(client, headers, home["id"])
    _, cabin_slot = create_surface_with_slot(
        client, headers, cabin["id"], slot_label="Cabin shelf"
    )

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Skis",
            "typicalLocationId": home["id"],
            "typicalPlacement": "tall cabinet",
            "placementSlotId": home_slot["id"],
        },
    )
    item_id = created.json()["item"]["id"]

    moved = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"typicalLocationId": cabin["id"]},
    )
    assert moved.status_code == 200
    item = moved.json()["item"]
    assert item["typicalLocation"]["id"] == cabin["id"]
    assert item["placementSlotId"] is None
    assert item["placementSlot"] is None
    assert item["typicalPlacement"] == "tall cabinet"

    # Does not re-link by matching labels on the new Location.
    assert item["placementSlotId"] != cabin_slot["id"]


def test_location_clear_auto_clears_slot(client: TestClient) -> None:
    owner = register_user(client, "clear-location@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot = create_surface_with_slot(client, headers, location["id"])

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Bike",
            "typicalLocationId": location["id"],
            "typicalPlacement": "wall hook",
            "placementSlotId": slot["id"],
        },
    )
    item_id = created.json()["item"]["id"]

    cleared = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"typicalLocationId": None},
    )
    assert cleared.status_code == 200
    item = cleared.json()["item"]
    assert item["typicalLocation"] is None
    assert item["placementSlotId"] is None
    assert item["typicalPlacement"] == "wall hook"


def test_location_change_and_explicit_new_slot_in_same_request(
    client: TestClient,
) -> None:
    owner = register_user(client, "move-and-link@example.com")
    headers = use_session(client, owner)
    home = create_location(client, headers, name="Home")
    cabin = create_location(client, headers, name="Cabin")
    _, home_slot = create_surface_with_slot(client, headers, home["id"])
    _, cabin_slot = create_surface_with_slot(
        client, headers, cabin["id"], slot_label="Cabin shelf"
    )

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Axe",
            "typicalLocationId": home["id"],
            "typicalPlacement": "handle up",
            "placementSlotId": home_slot["id"],
        },
    )
    item_id = created.json()["item"]["id"]

    moved = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={
            "typicalLocationId": cabin["id"],
            "placementSlotId": cabin_slot["id"],
        },
    )
    assert moved.status_code == 200
    item = moved.json()["item"]
    assert item["typicalLocation"]["id"] == cabin["id"]
    assert item["placementSlotId"] == cabin_slot["id"]
    assert item["typicalPlacement"] == "handle up"


def test_many_items_can_share_one_slot(client: TestClient) -> None:
    owner = register_user(client, "multi-item@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot = create_surface_with_slot(client, headers, location["id"])

    first = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Wrench",
            "typicalLocationId": location["id"],
            "placementSlotId": slot["id"],
        },
    )
    second = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Pliers",
            "typicalLocationId": location["id"],
            "typicalPlacement": "top",
            "placementSlotId": slot["id"],
        },
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["item"]["placementSlotId"] == slot["id"]
    assert second.json()["item"]["placementSlotId"] == slot["id"]


def test_slot_must_belong_to_item_typical_location(client: TestClient) -> None:
    owner = register_user(client, "wrong-location@example.com")
    headers = use_session(client, owner)
    home = create_location(client, headers, name="Home")
    cabin = create_location(client, headers, name="Cabin")
    _, cabin_slot = create_surface_with_slot(client, headers, cabin["id"])

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Tent",
            "typicalLocationId": home["id"],
            "placementSlotId": cabin_slot["id"],
        },
    )
    assert created.status_code == 400
    assert created.json()["code"] == "placement_slot_location_mismatch"

    free = client.post(
        "/api/items",
        headers=headers,
        json={"name": "Chair", "typicalLocationId": home["id"]},
    )
    item_id = free.json()["item"]["id"]
    patched = client.patch(
        f"/api/items/{item_id}",
        headers=headers,
        json={"placementSlotId": cabin_slot["id"]},
    )
    assert patched.status_code == 400
    assert patched.json()["code"] == "placement_slot_location_mismatch"


def test_cannot_link_slot_without_typical_location(client: TestClient) -> None:
    owner = register_user(client, "no-location@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot = create_surface_with_slot(client, headers, location["id"])

    created = client.post(
        "/api/items",
        headers=headers,
        json={"name": "Orphan link", "placementSlotId": slot["id"]},
    )
    assert created.status_code == 400
    assert created.json()["code"] == "placement_slot_requires_typical_location"


def test_unknown_slot_is_not_found(client: TestClient) -> None:
    owner = register_user(client, "missing-slot@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    missing_slot_id = "00000000-0000-4000-8000-000000000099"

    created = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Ghost",
            "typicalLocationId": location["id"],
            "placementSlotId": missing_slot_id,
        },
    )
    assert created.status_code == 404
    assert created.json()["code"] == "placement_slot_not_found"


def test_list_items_includes_linked_slot_summary(client: TestClient) -> None:
    owner = register_user(client, "list-slots@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot = create_surface_with_slot(client, headers, location["id"])

    client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "Listed",
            "typicalLocationId": location["id"],
            "placementSlotId": slot["id"],
            "typicalPlacement": "note",
        },
    )
    listed = client.get("/api/items", headers=headers)
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["placementSlotId"] == slot["id"]
    assert items[0]["placementSlot"]["label"] == "Shelf A"
    assert items[0]["typicalPlacement"] == "note"


def test_list_items_filters_by_placement_slot_id(client: TestClient) -> None:
    owner = register_user(client, "list-by-slot@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    _, slot_a = create_surface_with_slot(
        client, headers, location["id"], slot_label="Slot A"
    )
    _, slot_b = create_surface_with_slot(
        client,
        headers,
        location["id"],
        surface_name="Other wall",
        slot_label="Slot B",
    )

    client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "On A",
            "typicalLocationId": location["id"],
            "placementSlotId": slot_a["id"],
        },
    )
    client.post(
        "/api/items",
        headers=headers,
        json={
            "name": "On B",
            "typicalLocationId": location["id"],
            "placementSlotId": slot_b["id"],
        },
    )
    client.post(
        "/api/items",
        headers=headers,
        json={"name": "Unlinked", "typicalLocationId": location["id"]},
    )

    filtered = client.get(
        "/api/items",
        headers=headers,
        params={"placementSlotId": slot_a["id"]},
    )
    assert filtered.status_code == 200
    items = filtered.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "On A"
    assert items[0]["placementSlotId"] == slot_a["id"]

    with_location = client.get(
        "/api/items",
        headers=headers,
        params={
            "typicalLocationId": location["id"],
            "placementSlotId": slot_b["id"],
        },
    )
    assert with_location.status_code == 200
    assert len(with_location.json()["items"]) == 1
    assert with_location.json()["items"][0]["name"] == "On B"
