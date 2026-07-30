from typing import Final

from fastapi import HTTPException

PROBLEM_TYPE_ROOT: Final = "https://we-share-stuff.local/problems/"


def problem(
    status_code: int, code: str, title: str, errors: dict[str, str] | None = None
) -> HTTPException:
    detail: dict[str, object] = {
        "type": f"{PROBLEM_TYPE_ROOT}{code.replace('_', '-')}",
        "title": title,
        "status": status_code,
        "code": code,
    }
    if errors:
        detail["errors"] = errors
    return HTTPException(status_code=status_code, detail=detail)
