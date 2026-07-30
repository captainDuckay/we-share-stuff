from pathlib import Path
from typing import Annotated, Final
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import aliased
from sqlalchemy.orm.attributes import set_committed_value

from app.config import Settings, get_settings
from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.models import Item, ProfilePhoto, Reservation, SharingGroupMember, User
from app.problems import problem
from app.routers.auth import user_envelope
from app.schemas import ProfileUpdate, UserEnvelope

router = APIRouter(prefix="/api", tags=["profile"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]
AppSettings = Annotated[Settings, Depends(get_settings)]

ALLOWED_IMAGE_TYPES: Final = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_PROFILE_PHOTO_BYTES: Final = 10 * 1024 * 1024
READ_CHUNK_BYTES: Final = 1024 * 1024
PNG_SIGNATURE: Final = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE: Final = b"\xff\xd8\xff"
RIFF_SIGNATURE: Final = b"RIFF"
WEBP_SIGNATURE: Final = b"WEBP"
IMAGE_HEADER_BYTES: Final = 12


def storage_root(settings: Settings) -> Path:
    return Path(settings.profile_photo_storage_dir)


def storage_path(settings: Settings, photo: ProfilePhoto) -> Path:
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


async def locked_user(db: DatabaseSession, user_id: UUID) -> User:
    user = await db.scalar(
        select(User).where(User.id == user_id).with_for_update(of=User)
    )
    if user is None:
        raise problem(404, "user_not_found", "User was not found")
    photo = await db.scalar(
        select(ProfilePhoto)
        .where(ProfilePhoto.user_id == user_id)
        .execution_options(populate_existing=True)
    )
    set_committed_value(user, "profile_photo", photo)
    return user


async def can_view_profile(
    db: DatabaseSession, viewer_id: UUID, subject_id: UUID
) -> bool:
    if viewer_id == subject_id:
        return True

    viewer_membership = aliased(SharingGroupMember)
    subject_membership = aliased(SharingGroupMember)
    common_group = await db.scalar(
        select(viewer_membership.sharing_group_id)
        .join(
            subject_membership,
            subject_membership.sharing_group_id == viewer_membership.sharing_group_id,
        )
        .where(
            viewer_membership.user_id == viewer_id,
            subject_membership.user_id == subject_id,
        )
        .limit(1)
    )
    if common_group is not None:
        return True

    reservation = await db.scalar(
        select(Reservation.id)
        .join(Item, Item.id == Reservation.item_id)
        .where(
            or_(
                and_(
                    Reservation.requester_id == viewer_id,
                    Item.owner_id == subject_id,
                ),
                and_(
                    Reservation.requester_id == subject_id,
                    Item.owner_id == viewer_id,
                ),
            )
        )
        .limit(1)
    )
    return reservation is not None


@router.patch("/profile", response_model=UserEnvelope)
async def update_profile(
    payload: ProfileUpdate,
    db: DatabaseSession,
    current: AuthenticatedMutation,
) -> UserEnvelope:
    user = await locked_user(db, current.user.id)
    user.display_name = payload.display_name
    await db.commit()
    await db.refresh(user)
    return user_envelope(user)


@router.post("/profile/photo", response_model=UserEnvelope)
async def upload_profile_photo(
    db: DatabaseSession,
    current: AuthenticatedMutation,
    settings: AppSettings,
    file: UploadFile = File(...),
) -> UserEnvelope:
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise problem(
            415,
            "profile_photo_unsupported_type",
            "Profile Photo type is not supported",
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
                if size > MAX_PROFILE_PHOTO_BYTES:
                    raise problem(
                        413,
                        "profile_photo_too_large",
                        "Profile Photo is too large",
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
                "profile_photo_invalid_image",
                "Profile Photo content is not a supported image",
            )
    except Exception:
        if path.exists():
            path.unlink()
        raise

    user = await locked_user(db, current.user.id)
    photo = user.profile_photo
    previous_path = storage_path(settings, photo) if photo is not None else None
    if photo is None:
        photo = ProfilePhoto(
            user_id=user.id,
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

    user.profile_photo = photo
    if previous_path is not None and previous_path != path and previous_path.exists():
        try:
            previous_path.unlink()
        except OSError:
            pass
    return user_envelope(user)


@router.delete("/profile/photo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile_photo(
    db: DatabaseSession,
    current: AuthenticatedMutation,
    settings: AppSettings,
) -> None:
    user = await locked_user(db, current.user.id)
    photo = user.profile_photo
    if photo is None:
        return
    path = storage_path(settings, photo)
    await db.delete(photo)
    await db.commit()
    user.profile_photo = None
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass


@router.get("/profile-photos/{user_id}/content")
async def get_profile_photo_content(
    user_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
    settings: AppSettings,
) -> FileResponse:
    photo = await db.get(ProfilePhoto, user_id)
    if photo is None or not await can_view_profile(db, current.user.id, user_id):
        raise problem(404, "profile_photo_not_found", "Profile Photo was not found")
    path = storage_path(settings, photo)
    if not path.exists():
        raise problem(404, "profile_photo_not_found", "Profile Photo was not found")
    return FileResponse(
        path,
        media_type=photo.content_type,
        headers={"X-Content-Type-Options": "nosniff"},
    )
