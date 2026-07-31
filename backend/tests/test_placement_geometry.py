from app.placement_geometry import ContentBounds, content_bounds


def test_content_bounds_empty() -> None:
    assert content_bounds([], []) is None


def test_content_bounds_from_slots_and_structure() -> None:
    slots = [
        {"x": 100.0, "y": 50.0, "width": 40.0, "height": 20.0},
        {"x": 0.0, "y": 0.0, "width": 10.0, "height": 10.0},
    ]
    drawings = [
        {
            "kind": "rect",
            "x": -20.0,
            "y": -10.0,
            "width": 30.0,
            "height": 15.0,
            "points": None,
        },
        {
            "kind": "polyline",
            "x": None,
            "y": None,
            "width": None,
            "height": None,
            "points": [{"x": 200.0, "y": 5.0}, {"x": 250.0, "y": 80.0}],
        },
    ]
    bounds = content_bounds(slots, drawings)
    assert bounds == ContentBounds(
        min_x=-20.0,
        min_y=-10.0,
        max_x=250.0,
        max_y=80.0,
        width=270.0,
        height=90.0,
    )


def test_content_bounds_polyline_only() -> None:
    drawings = [
        {
            "kind": "polyline",
            "x": None,
            "y": None,
            "width": None,
            "height": None,
            "points": [{"x": 10.0, "y": 20.0}, {"x": 30.0, "y": 40.0}],
        }
    ]
    bounds = content_bounds([], drawings)
    assert bounds is not None
    assert bounds.min_x == 10.0
    assert bounds.max_y == 40.0
