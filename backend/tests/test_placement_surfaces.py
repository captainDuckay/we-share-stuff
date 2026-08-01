from dataclasses import dataclass

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

import app.routers.placement_surfaces as surfaces_router
from app.schemas import POLYLINE_POINTS_MAX

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
            "name": "Home",
            "details": "Main Street 1",
            "timezone": "Europe/Copenhagen",
        },
    )
    assert response.status_code == 201
    return response.json()["typicalLocation"]


def surfaces_url(location_id: str) -> str:
    return f"/api/typical-locations/{location_id}/placement-surfaces"


def surface_url(location_id: str, surface_id: str) -> str:
    return f"{surfaces_url(location_id)}/{surface_id}"


def slots_url(location_id: str, surface_id: str) -> str:
    return f"{surface_url(location_id, surface_id)}/slots"


def slot_url(location_id: str, surface_id: str, slot_id: str) -> str:
    return f"{slots_url(location_id, surface_id)}/{slot_id}"


def drawings_url(location_id: str, surface_id: str) -> str:
    return f"{surface_url(location_id, surface_id)}/structural-drawings"


def drawing_url(location_id: str, surface_id: str, drawing_id: str) -> str:
    return f"{drawings_url(location_id, surface_id)}/{drawing_id}"


def test_owner_can_crud_placement_surfaces(client: TestClient) -> None:
    owner = register_user(client, "surface-owner@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)

    empty = client.get(surfaces_url(location["id"]), headers=headers)
    assert empty.status_code == 200
    assert empty.json()["placementSurfaces"] == []

    created = client.post(
        surfaces_url(location["id"]),
        headers=headers,
        json={"name": "  Garage wall A  "},
    )
    assert created.status_code == 201
    surface = created.json()["placementSurface"]
    assert surface["name"] == "Garage wall A"
    assert surface["typicalLocationId"] == location["id"]
    assert "id" in surface

    listed = client.get(surfaces_url(location["id"]), headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["placementSurfaces"]) == 1
    assert listed.json()["placementSurfaces"][0]["name"] == "Garage wall A"

    detail = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    assert detail.status_code == 200
    body = detail.json()["placementSurface"]
    assert body["slots"] == []
    assert body["structuralDrawings"] == []

    renamed = client.patch(
        surface_url(location["id"], surface["id"]),
        headers=headers,
        json={"name": "  Wall A  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["placementSurface"]["name"] == "Wall A"

    deleted = client.delete(
        surface_url(location["id"], surface["id"]), headers=headers
    )
    assert deleted.status_code == 204
    after = client.get(surfaces_url(location["id"]), headers=headers)
    assert after.json()["placementSurfaces"] == []


def test_non_owner_cannot_access_placement_surfaces(client: TestClient) -> None:
    owner = register_user(client, "surface-owner-2@example.com")
    other = register_user(client, "surface-other@example.com")
    owner_headers = use_session(client, owner)
    location = create_location(client, owner_headers)
    created = client.post(
        surfaces_url(location["id"]),
        headers=owner_headers,
        json={"name": "Shed"},
    )
    surface_id = created.json()["placementSurface"]["id"]
    slot = client.post(
        slots_url(location["id"], surface_id),
        headers=owner_headers,
        json={"label": "Bin", "x": 0, "y": 0, "width": 10, "height": 10},
    ).json()["placementSlot"]
    drawing = client.post(
        drawings_url(location["id"], surface_id),
        headers=owner_headers,
        json={"kind": "rect", "x": 0, "y": 0, "width": 20, "height": 20},
    ).json()["structuralDrawing"]

    other_headers = use_session(client, other)
    listed = client.get(surfaces_url(location["id"]), headers=other_headers)
    assert listed.status_code == 404
    assert listed.json()["code"] == "typical_location_not_found"

    detail = client.get(surface_url(location["id"], surface_id), headers=other_headers)
    assert detail.status_code == 404
    assert detail.json()["code"] == "typical_location_not_found"

    created_by_other = client.post(
        surfaces_url(location["id"]),
        headers=other_headers,
        json={"name": "Hijack"},
    )
    assert created_by_other.status_code == 404

    patched = client.patch(
        surface_url(location["id"], surface_id),
        headers=other_headers,
        json={"name": "Nope"},
    )
    assert patched.status_code == 404

    deleted = client.delete(
        surface_url(location["id"], surface_id), headers=other_headers
    )
    assert deleted.status_code == 404

    slot_create = client.post(
        slots_url(location["id"], surface_id),
        headers=other_headers,
        json={"label": "Stolen", "x": 1, "y": 1, "width": 5, "height": 5},
    )
    assert slot_create.status_code == 404

    slot_patch = client.patch(
        slot_url(location["id"], surface_id, slot["id"]),
        headers=other_headers,
        json={"label": "Hijacked"},
    )
    assert slot_patch.status_code == 404

    slot_delete = client.delete(
        slot_url(location["id"], surface_id, slot["id"]), headers=other_headers
    )
    assert slot_delete.status_code == 404

    drawing_create = client.post(
        drawings_url(location["id"], surface_id),
        headers=other_headers,
        json={"kind": "rect", "x": 0, "y": 0, "width": 5, "height": 5},
    )
    assert drawing_create.status_code == 404

    drawing_patch = client.patch(
        drawing_url(location["id"], surface_id, drawing["id"]),
        headers=other_headers,
        json={"x": 99},
    )
    assert drawing_patch.status_code == 404

    drawing_delete = client.delete(
        drawing_url(location["id"], surface_id, drawing["id"]), headers=other_headers
    )
    assert drawing_delete.status_code == 404


def test_slot_crud_geometry_and_stable_id(client: TestClient) -> None:
    owner = register_user(client, "slot-owner@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]

    created = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={
            "label": "  Blue bin  ",
            "x": 100.5,
            "y": 50,
            "width": 200,
            "height": 80,
        },
    )
    assert created.status_code == 201
    slot = created.json()["placementSlot"]
    assert slot["label"] == "Blue bin"
    assert slot["x"] == 100.5
    assert slot["y"] == 50
    assert slot["width"] == 200
    assert slot["height"] == 80
    assert slot["surfaceId"] == surface["id"]
    stable_id = slot["id"]

    blank = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "   ", "x": 0, "y": 0, "width": 10, "height": 10},
    )
    assert blank.status_code == 400
    assert blank.json()["code"] == "validation_failed"

    zero_size = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "Tiny", "x": 0, "y": 0, "width": 0, "height": 10},
    )
    assert zero_size.status_code == 400
    assert zero_size.json()["code"] == "validation_failed"

    renamed = client.patch(
        slot_url(location["id"], surface["id"], stable_id),
        headers=headers,
        json={"label": "  Blue Bin  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["placementSlot"]["id"] == stable_id
    assert renamed.json()["placementSlot"]["label"] == "Blue Bin"

    resized = client.patch(
        slot_url(location["id"], surface["id"], stable_id),
        headers=headers,
        json={"x": 10, "y": 20, "width": 150, "height": 90},
    )
    assert resized.status_code == 200
    body = resized.json()["placementSlot"]
    assert body["id"] == stable_id
    assert body["x"] == 10
    assert body["width"] == 150
    assert body["height"] == 90

    detail = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    assert len(detail.json()["placementSurface"]["slots"]) == 1
    assert detail.json()["placementSurface"]["slots"][0]["id"] == stable_id

    deleted = client.delete(
        slot_url(location["id"], surface["id"], stable_id), headers=headers
    )
    assert deleted.status_code == 204
    detail_after = client.get(
        surface_url(location["id"], surface["id"]), headers=headers
    )
    assert detail_after.json()["placementSurface"]["slots"] == []


def test_slot_label_unique_per_typical_location_case_insensitive(
    client: TestClient,
) -> None:
    owner = register_user(client, "slot-unique@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    wall = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    shed = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Shed"}
    ).json()["placementSurface"]

    first = client.post(
        slots_url(location["id"], wall["id"]),
        headers=headers,
        json={"label": "E27", "x": 0, "y": 0, "width": 40, "height": 40},
    )
    assert first.status_code == 201

    collision_same_surface = client.post(
        slots_url(location["id"], wall["id"]),
        headers=headers,
        json={"label": "e27", "x": 50, "y": 0, "width": 40, "height": 40},
    )
    assert collision_same_surface.status_code == 409
    assert (
        collision_same_surface.json()["code"] == "placement_slot_label_conflict"
    )

    collision_other_surface = client.post(
        slots_url(location["id"], shed["id"]),
        headers=headers,
        json={"label": " E27 ", "x": 0, "y": 0, "width": 40, "height": 40},
    )
    assert collision_other_surface.status_code == 409
    assert (
        collision_other_surface.json()["code"] == "placement_slot_label_conflict"
    )

    other = client.post(
        slots_url(location["id"], shed["id"]),
        headers=headers,
        json={"label": "Top left", "x": 0, "y": 0, "width": 40, "height": 40},
    )
    assert other.status_code == 201
    other_id = other.json()["placementSlot"]["id"]

    rename_collision = client.patch(
        slot_url(location["id"], shed["id"], other_id),
        headers=headers,
        json={"label": "e27"},
    )
    assert rename_collision.status_code == 409
    assert rename_collision.json()["code"] == "placement_slot_label_conflict"

    rename_same = client.patch(
        slot_url(location["id"], wall["id"], first.json()["placementSlot"]["id"]),
        headers=headers,
        json={"label": "E27"},
    )
    assert rename_same.status_code == 200


def test_structural_drawing_rect_and_polyline_crud(client: TestClient) -> None:
    owner = register_user(client, "struct-owner@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]

    rect = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "rect", "x": 10, "y": 20, "width": 300, "height": 100},
    )
    assert rect.status_code == 201
    rect_body = rect.json()["structuralDrawing"]
    assert rect_body["kind"] == "rect"
    assert rect_body["x"] == 10
    assert rect_body["width"] == 300
    assert "label" not in rect_body
    assert rect_body["points"] is None

    line = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={
            "kind": "polyline",
            "points": [{"x": 0, "y": 50}, {"x": 200, "y": 50}],
        },
    )
    assert line.status_code == 201
    line_body = line.json()["structuralDrawing"]
    assert line_body["kind"] == "polyline"
    assert line_body["points"] == [{"x": 0, "y": 50}, {"x": 200, "y": 50}]
    assert line_body["x"] is None

    bad_kind = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "ellipse", "x": 0, "y": 0, "width": 10, "height": 10},
    )
    assert bad_kind.status_code == 400

    short_line = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "polyline", "points": [{"x": 0, "y": 0}]},
    )
    assert short_line.status_code == 400

    missing_rect = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "rect", "x": 0, "y": 0},
    )
    assert missing_rect.status_code == 400

    patched = client.patch(
        drawing_url(location["id"], surface["id"], rect_body["id"]),
        headers=headers,
        json={"x": 15, "width": 280},
    )
    assert patched.status_code == 200
    assert patched.json()["structuralDrawing"]["x"] == 15
    assert patched.json()["structuralDrawing"]["width"] == 280

    line_patch = client.patch(
        drawing_url(location["id"], surface["id"], line_body["id"]),
        headers=headers,
        json={"points": [{"x": 5, "y": 5}, {"x": 100, "y": 5}, {"x": 100, "y": 80}]},
    )
    assert line_patch.status_code == 200
    assert len(line_patch.json()["structuralDrawing"]["points"]) == 3

    detail = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    drawings = detail.json()["placementSurface"]["structuralDrawings"]
    assert len(drawings) == 2

    deleted = client.delete(
        drawing_url(location["id"], surface["id"], rect_body["id"]), headers=headers
    )
    assert deleted.status_code == 204
    detail_after = client.get(
        surface_url(location["id"], surface["id"]), headers=headers
    )
    remaining = detail_after.json()["placementSurface"]["structuralDrawings"]
    assert len(remaining) == 1
    assert remaining[0]["id"] == line_body["id"]


def test_surface_delete_cascades_slots_and_drawings(client: TestClient) -> None:
    owner = register_user(client, "cascade-owner@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "A", "x": 0, "y": 0, "width": 10, "height": 10},
    )
    client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "rect", "x": 0, "y": 0, "width": 50, "height": 50},
    )

    deleted = client.delete(
        surface_url(location["id"], surface["id"]), headers=headers
    )
    assert deleted.status_code == 204
    missing = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    assert missing.status_code == 404


def test_multiple_surfaces_without_item_links(client: TestClient) -> None:
    owner = register_user(client, "multi-surface@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    for name in ("Wall A", "Wall B", "Shed"):
        response = client.post(
            surfaces_url(location["id"]), headers=headers, json={"name": name}
        )
        assert response.status_code == 201
    listed = client.get(surfaces_url(location["id"]), headers=headers)
    assert len(listed.json()["placementSurfaces"]) == 3


def test_geometry_rejects_non_finite_and_oversized_polylines(
    client: TestClient,
) -> None:
    owner = register_user(client, "geom-limits@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]

    non_finite_slot = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={
            "label": "Bad",
            "x": "NaN",
            "y": 0,
            "width": 10,
            "height": 10,
        },
    )
    assert non_finite_slot.status_code == 400
    assert non_finite_slot.json()["code"] == "validation_failed"

    infinite_width = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={
            "label": "Infinite",
            "x": 0,
            "y": 0,
            "width": "Infinity",
            "height": 10,
        },
    )
    assert infinite_width.status_code == 400
    assert infinite_width.json()["code"] == "validation_failed"

    too_many_points = [
        {"x": float(index), "y": 0.0} for index in range(POLYLINE_POINTS_MAX + 1)
    ]
    oversized = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "polyline", "points": too_many_points},
    )
    assert oversized.status_code == 400
    assert oversized.json()["code"] == "validation_failed"

    at_limit = [
        {"x": float(index), "y": 0.0} for index in range(POLYLINE_POINTS_MAX)
    ]
    ok_polyline = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "polyline", "points": at_limit},
    )
    assert ok_polyline.status_code == 201
    assert len(ok_polyline.json()["structuralDrawing"]["points"]) == POLYLINE_POINTS_MAX

    non_finite_point = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={
            "kind": "polyline",
            "points": [{"x": 0, "y": 0}, {"x": "NaN", "y": 1}],
        },
    )
    assert non_finite_point.status_code == 400
    assert non_finite_point.json()["code"] == "validation_failed"


def test_placement_collection_quotas(
    client: TestClient, monkeypatch: MonkeyPatch
) -> None:
    monkeypatch.setattr(surfaces_router, "MAX_PLACEMENT_SURFACES_PER_LOCATION", 2)
    monkeypatch.setattr(surfaces_router, "MAX_PLACEMENT_SLOTS_PER_LOCATION", 2)
    monkeypatch.setattr(surfaces_router, "MAX_STRUCTURAL_DRAWINGS_PER_SURFACE", 2)

    owner = register_user(client, "quota-owner@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)

    first = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "One"}
    )
    second = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Two"}
    )
    assert first.status_code == 201
    assert second.status_code == 201
    surface_id = first.json()["placementSurface"]["id"]

    third_surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Three"}
    )
    assert third_surface.status_code == 409
    assert third_surface.json()["code"] == "placement_surface_limit_exceeded"

    slot_a = client.post(
        slots_url(location["id"], surface_id),
        headers=headers,
        json={"label": "A", "x": 0, "y": 0, "width": 10, "height": 10},
    )
    slot_b = client.post(
        slots_url(location["id"], surface_id),
        headers=headers,
        json={"label": "B", "x": 20, "y": 0, "width": 10, "height": 10},
    )
    assert slot_a.status_code == 201
    assert slot_b.status_code == 201
    slot_c = client.post(
        slots_url(location["id"], surface_id),
        headers=headers,
        json={"label": "C", "x": 40, "y": 0, "width": 10, "height": 10},
    )
    assert slot_c.status_code == 409
    assert slot_c.json()["code"] == "placement_slot_limit_exceeded"

    drawing_a = client.post(
        drawings_url(location["id"], surface_id),
        headers=headers,
        json={"kind": "rect", "x": 0, "y": 0, "width": 5, "height": 5},
    )
    drawing_b = client.post(
        drawings_url(location["id"], surface_id),
        headers=headers,
        json={"kind": "rect", "x": 10, "y": 0, "width": 5, "height": 5},
    )
    assert drawing_a.status_code == 201
    assert drawing_b.status_code == 201
    drawing_c = client.post(
        drawings_url(location["id"], surface_id),
        headers=headers,
        json={"kind": "rect", "x": 20, "y": 0, "width": 5, "height": 5},
    )
    assert drawing_c.status_code == 409
    assert drawing_c.json()["code"] == "structural_drawing_limit_exceeded"


def _create_item_on_slot(
    client: TestClient,
    headers: dict[str, str],
    location_id: str,
    slot_id: str,
    name: str = "Linked tool",
) -> dict:
    response = client.post(
        "/api/items",
        headers=headers,
        json={
            "name": name,
            "typicalLocationId": location_id,
            "placementSlotId": slot_id,
        },
    )
    assert response.status_code == 201
    return response.json()["item"]


def test_slot_delete_blocked_while_items_link_and_free_when_unlinked(
    client: TestClient,
) -> None:
    owner = register_user(client, "slot-delete-block@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    slot = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "Bin", "x": 0, "y": 0, "width": 10, "height": 10},
    ).json()["placementSlot"]
    item_a = _create_item_on_slot(
        client, headers, location["id"], slot["id"], name="Drill"
    )
    item_b = _create_item_on_slot(
        client, headers, location["id"], slot["id"], name="Saw"
    )

    blocked = client.delete(
        slot_url(location["id"], surface["id"], slot["id"]), headers=headers
    )
    assert blocked.status_code == 409
    body = blocked.json()
    assert body["code"] == "placement_slot_in_use"
    assert body["errors"]["linkedItemCount"] == "2"

    # Slot still present; items still linked (no silent unlink).
    detail = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    assert len(detail.json()["placementSurface"]["slots"]) == 1
    still_linked = client.get(
        "/api/items", headers=headers, params={"placementSlotId": slot["id"]}
    )
    linked_ids = {entry["id"] for entry in still_linked.json()["items"]}
    assert linked_ids == {item_a["id"], item_b["id"]}

    client.patch(
        f"/api/items/{item_a['id']}", headers=headers, json={"placementSlotId": None}
    )
    client.patch(
        f"/api/items/{item_b['id']}", headers=headers, json={"placementSlotId": None}
    )

    free = client.delete(
        slot_url(location["id"], surface["id"], slot["id"]), headers=headers
    )
    assert free.status_code == 204
    after = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    assert after.json()["placementSurface"]["slots"] == []


def test_surface_delete_blocked_when_any_slot_has_item_links(
    client: TestClient,
) -> None:
    owner = register_user(client, "surface-delete-block@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    slot_linked = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "Used", "x": 0, "y": 0, "width": 10, "height": 10},
    ).json()["placementSlot"]
    client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "Free", "x": 20, "y": 0, "width": 10, "height": 10},
    )
    client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "rect", "x": 0, "y": 0, "width": 50, "height": 50},
    )
    _create_item_on_slot(client, headers, location["id"], slot_linked["id"])

    blocked = client.delete(
        surface_url(location["id"], surface["id"]), headers=headers
    )
    assert blocked.status_code == 409
    body = blocked.json()
    assert body["code"] == "placement_surface_in_use"
    assert body["errors"]["linkedItemCount"] == "1"

    # No partial cascade: surface, both slots, and drawing remain.
    detail = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    assert detail.status_code == 200
    surface_body = detail.json()["placementSurface"]
    assert len(surface_body["slots"]) == 2
    assert len(surface_body["structuralDrawings"]) == 1


def test_drawing_always_deletable_even_when_sibling_slots_linked(
    client: TestClient,
) -> None:
    owner = register_user(client, "drawing-free-delete@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    slot = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "Linked", "x": 0, "y": 0, "width": 10, "height": 10},
    ).json()["placementSlot"]
    drawing = client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "rect", "x": 0, "y": 0, "width": 20, "height": 20},
    ).json()["structuralDrawing"]
    _create_item_on_slot(client, headers, location["id"], slot["id"])

    deleted = client.delete(
        drawing_url(location["id"], surface["id"], drawing["id"]), headers=headers
    )
    assert deleted.status_code == 204
    detail = client.get(surface_url(location["id"], surface["id"]), headers=headers)
    assert detail.json()["placementSurface"]["structuralDrawings"] == []
    assert len(detail.json()["placementSurface"]["slots"]) == 1


def test_free_surface_delete_cascades_slots_and_drawings_with_no_item_links(
    client: TestClient,
) -> None:
    owner = register_user(client, "free-cascade@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "A", "x": 0, "y": 0, "width": 10, "height": 10},
    )
    client.post(
        drawings_url(location["id"], surface["id"]),
        headers=headers,
        json={"kind": "polyline", "points": [{"x": 0, "y": 0}, {"x": 10, "y": 10}]},
    )

    deleted = client.delete(
        surface_url(location["id"], surface["id"]), headers=headers
    )
    assert deleted.status_code == 204
    listed = client.get(surfaces_url(location["id"]), headers=headers)
    assert listed.json()["placementSurfaces"] == []


def test_reparent_slot_same_location_keeps_id_links_and_geometry(
    client: TestClient,
) -> None:
    owner = register_user(client, "reparent-same@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    wall = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    shed = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Shed"}
    ).json()["placementSurface"]
    slot = client.post(
        slots_url(location["id"], wall["id"]),
        headers=headers,
        json={"label": "Traveler", "x": 12.5, "y": 30, "width": 40, "height": 50},
    ).json()["placementSlot"]
    item = _create_item_on_slot(client, headers, location["id"], slot["id"])

    reparented = client.patch(
        slot_url(location["id"], wall["id"], slot["id"]),
        headers=headers,
        json={"surfaceId": shed["id"]},
    )
    assert reparented.status_code == 200
    body = reparented.json()["placementSlot"]
    assert body["id"] == slot["id"]
    assert body["surfaceId"] == shed["id"]
    assert body["x"] == 12.5
    assert body["y"] == 30
    assert body["width"] == 40
    assert body["height"] == 50
    assert body["label"] == "Traveler"

    # Source surface no longer lists the slot; target does.
    wall_detail = client.get(
        surface_url(location["id"], wall["id"]), headers=headers
    )
    assert wall_detail.json()["placementSurface"]["slots"] == []
    shed_detail = client.get(
        surface_url(location["id"], shed["id"]), headers=headers
    )
    assert len(shed_detail.json()["placementSurface"]["slots"]) == 1
    assert shed_detail.json()["placementSurface"]["slots"][0]["id"] == slot["id"]

    # Item link retained on stable slot id.
    item_after = client.get(
        "/api/items", headers=headers, params={"placementSlotId": slot["id"]}
    )
    assert len(item_after.json()["items"]) == 1
    assert item_after.json()["items"][0]["id"] == item["id"]
    assert item_after.json()["items"][0]["placementSlot"]["surfaceId"] == shed["id"]


def test_reparent_slot_cross_location_rejected(client: TestClient) -> None:
    owner = register_user(client, "reparent-cross@example.com")
    headers = use_session(client, owner)
    home = create_location(client, headers)
    # Second location
    cabin = client.post(
        "/api/typical-locations",
        headers=headers,
        json={
            "name": "Cabin",
            "details": None,
            "timezone": "Europe/Copenhagen",
        },
    ).json()["typicalLocation"]
    home_surface = client.post(
        surfaces_url(home["id"]), headers=headers, json={"name": "Home wall"}
    ).json()["placementSurface"]
    cabin_surface = client.post(
        surfaces_url(cabin["id"]), headers=headers, json={"name": "Cabin wall"}
    ).json()["placementSurface"]
    slot = client.post(
        slots_url(home["id"], home_surface["id"]),
        headers=headers,
        json={"label": "Stay home", "x": 0, "y": 0, "width": 10, "height": 10},
    ).json()["placementSlot"]

    rejected = client.patch(
        slot_url(home["id"], home_surface["id"], slot["id"]),
        headers=headers,
        json={"surfaceId": cabin_surface["id"]},
    )
    assert rejected.status_code == 400
    assert rejected.json()["code"] == "placement_slot_reparent_location_mismatch"

    # Slot remains on home surface.
    home_detail = client.get(
        surface_url(home["id"], home_surface["id"]), headers=headers
    )
    assert len(home_detail.json()["placementSurface"]["slots"]) == 1


def test_rename_and_move_geometry_allowed_while_items_linked(
    client: TestClient,
) -> None:
    owner = register_user(client, "live-edit-linked@example.com")
    headers = use_session(client, owner)
    location = create_location(client, headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    slot = client.post(
        slots_url(location["id"], surface["id"]),
        headers=headers,
        json={"label": "Old label", "x": 0, "y": 0, "width": 10, "height": 10},
    ).json()["placementSlot"]
    _create_item_on_slot(client, headers, location["id"], slot["id"])

    renamed_surface = client.patch(
        surface_url(location["id"], surface["id"]),
        headers=headers,
        json={"name": "Renamed wall"},
    )
    assert renamed_surface.status_code == 200
    assert renamed_surface.json()["placementSurface"]["name"] == "Renamed wall"

    renamed_slot = client.patch(
        slot_url(location["id"], surface["id"], slot["id"]),
        headers=headers,
        json={"label": "New label", "x": 5, "y": 15, "width": 80, "height": 60},
    )
    assert renamed_slot.status_code == 200
    body = renamed_slot.json()["placementSlot"]
    assert body["label"] == "New label"
    assert body["x"] == 5
    assert body["width"] == 80
    assert body["id"] == slot["id"]


def test_accepted_reservation_snapshot_does_not_block_structure_delete_after_unlink(
    client: TestClient,
) -> None:
    """Accepted Reservation snapshots are copies — no live structure lock after unlink."""
    owner = register_user(client, "snapshot-no-lock-owner@example.com")
    borrower = register_user(client, "snapshot-no-lock-borrower@example.com")
    owner_headers = use_session(client, owner)

    group = client.post(
        "/api/sharing-groups",
        headers=owner_headers,
        json={"name": "Yard share"},
    ).json()["sharingGroup"]
    invite = client.post(
        f"/api/sharing-groups/{group['id']}/invitations",
        headers=owner_headers,
        json={"email": "snapshot-no-lock-borrower@example.com"},
    )
    assert invite.status_code == 201
    invitation_id = invite.json()["invitation"]["id"]
    borrower_headers = use_session(client, borrower)
    accepted_invite = client.post(
        f"/api/invitations/{invitation_id}/accept",
        headers=borrower_headers,
    )
    assert accepted_invite.status_code == 200

    owner_headers = use_session(client, owner)
    location = create_location(client, owner_headers)
    surface = client.post(
        surfaces_url(location["id"]), headers=owner_headers, json={"name": "Wall"}
    ).json()["placementSurface"]
    slot = client.post(
        slots_url(location["id"], surface["id"]),
        headers=owner_headers,
        json={"label": "Hook", "x": 0, "y": 0, "width": 20, "height": 20},
    ).json()["placementSlot"]
    item = client.post(
        "/api/items",
        headers=owner_headers,
        json={
            "name": "Rake",
            "typicalLocationId": location["id"],
            "placementSlotId": slot["id"],
        },
    ).json()["item"]
    assert (
        client.post(
            f"/api/items/{item['id']}/sharing-groups/{group['id']}",
            headers=owner_headers,
        ).status_code
        == 201
    )

    borrower_headers = use_session(client, borrower)
    reservation_response = client.post(
        f"/api/sharing-groups/{group['id']}/shared-items/{item['id']}/reservations",
        headers=borrower_headers,
        json={
            "startLocal": "2099-12-01T10:00:00",
            "endLocal": "2099-12-01T12:00:00",
        },
    )
    assert reservation_response.status_code == 201
    reservation = reservation_response.json()["reservation"]
    owner_headers = use_session(client, owner)
    assert (
        client.post(
            f"/api/reservations/{reservation['id']}/accept", headers=owner_headers
        ).status_code
        == 200
    )

    # Live link still blocks delete.
    blocked = client.delete(
        slot_url(location["id"], surface["id"], slot["id"]), headers=owner_headers
    )
    assert blocked.status_code == 409

    # Unlink item; accepted reservation snapshot must not keep the lock.
    client.patch(
        f"/api/items/{item['id']}",
        headers=owner_headers,
        json={"placementSlotId": None},
    )
    free = client.delete(
        slot_url(location["id"], surface["id"], slot["id"]), headers=owner_headers
    )
    assert free.status_code == 204
    surface_delete = client.delete(
        surface_url(location["id"], surface["id"]), headers=owner_headers
    )
    assert surface_delete.status_code == 204
