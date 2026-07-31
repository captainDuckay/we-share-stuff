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
