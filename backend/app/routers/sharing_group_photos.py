from pathlib import Path
from typing import Annotated, Final
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.config import Settings, get_settings
from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.domain import require_group_member, sharing_group_response
from app.models import SharingGroup, SharingGroupPhoto
from app.problems import problem
from app.schemas import SharingGroupEnvelope

router = APIRouter(prefix="/api/sharing-groups", tags=["sharing-groups"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]
AppSettings = Annotated[Settings, Depends(get_settings)]

ALLOWED_IMAGE_TYPES: Final = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_SHARING_GROUP_PHOTO_BYTES: Final = 10 * 1024 * 1024
READ_CHUNK_BYTES: Final = 1024 * 1024
PNG_SIGNATURE: Final = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE: Final = b"\xff\xd8\xff"
RIFF_SIGNATURE: Final = b"RIFF"
WEBP_SIGNATURE: Final = b"WEBP"
IMAGE_HEADER_BYTES: Final = 12


def storage_root(settings: Settings) -> Path:
    return Path(settings.sharing_group_photo_storage_dir)


def storage_path(settings: Settings, photo: SharingGroupPhoto) -> Path:
    return storage_root(settings) / photo.storage_path


def has_valid_image_signature(path: Path, content_type: str) -> bool:
    with path.open("rb") as image:
        header = image.read(IMAGE_HEADER_BYTES)
    if content_type == "image/png":
        return header.startswith(PNG_SIGNATURE)
    if content_type == "image/jpeg":
        return header.startswith(JPEG_SIGNATURE)
    return (
        content_type == "image/webp"
        and header.startswith(RIFF_SIGNATURE)
        and header[8:12] == WEBP_SIGNATURE
    )


async def managed_group(
    db: DatabaseSession, sharing_group_id: UUID, user_id: UUID
) -> SharingGroup:
    group = await db.scalar(
        select(SharingGroup)
        .where(
            SharingGroup.id == sharing_group_id,
            SharingGroup.created_by_id == user_id,
        )
        .with_for_update(of=SharingGroup)
    )
    if group is None:
        raise problem(404, "sharing_group_not_found", "Sharing Group was not found")
    return group


@router.post("/{sharing_group_id}/photo", response_model=SharingGroupEnvelope)
async def upload_sharing_group_photo(
    sharing_group_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
    settings: AppSettings,
    file: UploadFile = File(...),
) -> SharingGroupEnvelope:
    group = await managed_group(db, sharing_group_id, current.user.id)
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise problem(
            415,
            "sharing_group_photo_unsupported_type",
            "Sharing Group Photo type is not supported",
        )

    filename = f"{uuid4()}{extension}"
    root = storage_root(settings)
    root.mkdir(parents=True, exist_ok=True)
    path = root / filename
    size = 0
    try:
        with path.open("wb") as output:
            while chunk := await file.read(READ_CHUNK_BYTES):
                size += len(chunk)
                if size > MAX_SHARING_GROUP_PHOTO_BYTES:
                    raise problem(
                        413,
                        "sharing_group_photo_too_large",
                        "Sharing Group Photo is too large",
                    )
                output.write(chunk)
        if size == 0:
            raise problem(
                400,
                "validation_failed",
                "Validation failed",
                {"file": "must not be empty"},
            )
        if not has_valid_image_signature(path, content_type):
            raise problem(
                415,
                "sharing_group_photo_invalid_image",
                "Sharing Group Photo content is not a supported image",
            )
    except Exception:
        if path.exists():
            path.unlink()
        raise

    photo = await db.get(SharingGroupPhoto, group.id)
    previous_path = storage_path(settings, photo) if photo is not None else None
    if photo is None:
        photo = SharingGroupPhoto(
            sharing_group_id=group.id,
            storage_path=filename,
            content_type=content_type,
            size_bytes=size,
        )
        db.add(photo)
    else:
        photo.storage_path = filename
        photo.content_type = content_type
        photo.size_bytes = size
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        if path.exists():
            path.unlink()
        raise

    if previous_path is not None and previous_path != path and previous_path.exists():
        try:
            previous_path.unlink()
        except OSError:
            pass
    return SharingGroupEnvelope(
        sharing_group=await sharing_group_response(db, group, current.user.id)
    )


@router.delete("/{sharing_group_id}/photo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sharing_group_photo(
    sharing_group_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
    settings: AppSettings,
) -> None:
    group = await managed_group(db, sharing_group_id, current.user.id)
    photo = await db.get(SharingGroupPhoto, group.id)
    if photo is None:
        return
    path = storage_path(settings, photo)
    await db.delete(photo)
    await db.commit()
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass


@router.get("/{sharing_group_id}/photo/content")
async def get_sharing_group_photo_content(
    sharing_group_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
    settings: AppSettings,
) -> FileResponse:
    group = await require_group_member(db, sharing_group_id, current.user.id)
    photo = await db.get(SharingGroupPhoto, group.id)
    if photo is None:
        raise problem(
            404, "sharing_group_photo_not_found", "Sharing Group Photo was not found"
        )
    path = storage_path(settings, photo)
    if not path.exists():
        raise problem(
            404, "sharing_group_photo_not_found", "Sharing Group Photo was not found"
        )
    return FileResponse(
        path,
        media_type=photo.content_type,
        headers={"X-Content-Type-Options": "nosniff"},
    )
