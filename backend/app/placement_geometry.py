"""Pure geometry helpers for Placement Surfaces (content-derived extent)."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ContentBounds:
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    width: float
    height: float


def content_bounds(
    slots: Sequence[Mapping[str, float]],
    drawings: Sequence[Mapping[str, object]],
) -> ContentBounds | None:
    """Derive axis-aligned bounds from slots and structural drawings in mm."""
    min_x = float("inf")
    min_y = float("inf")
    max_x = float("-inf")
    max_y = float("-inf")
    any_point = False

    def include(x: float, y: float, w: float = 0.0, h: float = 0.0) -> None:
        nonlocal min_x, min_y, max_x, max_y, any_point
        any_point = True
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x + w)
        max_y = max(max_y, y + h)

    for slot in slots:
        include(float(slot["x"]), float(slot["y"]), float(slot["width"]), float(slot["height"]))

    for drawing in drawings:
        kind = drawing.get("kind")
        if kind == "rect":
            include(
                float(drawing["x"]),  # type: ignore[arg-type]
                float(drawing["y"]),  # type: ignore[arg-type]
                float(drawing["width"]),  # type: ignore[arg-type]
                float(drawing["height"]),  # type: ignore[arg-type]
            )
        else:
            points = drawing.get("points") or []
            if isinstance(points, Sequence):
                for point in points:
                    if isinstance(point, Mapping):
                        include(float(point["x"]), float(point["y"]))

    if not any_point:
        return None
    return ContentBounds(
        min_x=min_x,
        min_y=min_y,
        max_x=max_x,
        max_y=max_y,
        width=max_x - min_x,
        height=max_y - min_y,
    )
