from pathlib import Path
from typing import Annotated, Final
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.config import Settings, get_settings
from app.csrf import require_session_csrf
from app.dependencies import CurrentSession, CurrentSessionDependency, DatabaseSession
from app.domain import item_photo_response
from app.models import Item, ItemPhoto, ItemSharing, SharingGroupMember
from app.problems import problem
from app.schemas import ItemPhotoEnvelope, ItemPhotosEnvelope

router = APIRouter(prefix="/api", tags=["item-photos"])
AuthenticatedMutation = Annotated[CurrentSession, Depends(require_session_csrf)]
AppSettings = Annotated[Settings, Depends(get_settings)]

ALLOWED_IMAGE_TYPES: Final = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_ITEM_PHOTO_BYTES: Final = 10 * 1024 * 1024
READ_CHUNK_BYTES: Final = 1024 * 1024


async def owned_item(db: DatabaseSession, item_id: UUID, owner_id: UUID) -> Item:
    item = await db.scalar(
        select(Item).where(Item.id == item_id, Item.owner_id == owner_id)
    )
    if item is None:
        raise problem(404, "item_not_found", "Item was not found")
    return item


async def owned_item_photo(
    db: DatabaseSession, item_id: UUID, item_photo_id: UUID, owner_id: UUID
) -> ItemPhoto:
    photo = await db.scalar(
        select(ItemPhoto)
        .join(Item, Item.id == ItemPhoto.item_id)
        .where(
            ItemPhoto.id == item_photo_id,
            ItemPhoto.item_id == item_id,
            Item.owner_id == owner_id,
        )
    )
    if photo is None:
        raise problem(404, "item_photo_not_found", "Item Photo was not found")
    return photo


def storage_root(settings: Settings) -> Path:
    return Path(settings.item_photo_storage_dir)


def storage_path(settings: Settings, photo: ItemPhoto) -> Path:
    return storage_root(settings) / photo.storage_path


@router.get("/items/{item_id}/photos", response_model=ItemPhotosEnvelope)
async def list_item_photos(
    item_id: UUID, db: DatabaseSession, current: CurrentSessionDependency
) -> ItemPhotosEnvelope:
    item = await owned_item(db, item_id, current.user.id)
    result = await db.scalars(
        select(ItemPhoto)
        .where(ItemPhoto.item_id == item.id)
        .order_by(ItemPhoto.created_at, ItemPhoto.id)
    )
    return ItemPhotosEnvelope(
        item_photos=[item_photo_response(photo) for photo in result]
    )


@router.post(
    "/items/{item_id}/photos",
    response_model=ItemPhotoEnvelope,
    status_code=status.HTTP_201_CREATED,
)
async def upload_item_photo(
    item_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
    settings: AppSettings,
    file: UploadFile = File(...),
) -> ItemPhotoEnvelope:
    item = await owned_item(db, item_id, current.user.id)
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise problem(
            415,
            "item_photo_unsupported_type",
            "Item Photo type is not supported",
        )

    photo_id = uuid4()
    filename = f"{photo_id}{extension}"
    root = storage_root(settings)
    root.mkdir(parents=True, exist_ok=True)
    path = root / filename
    size = 0
    try:
        with path.open("wb") as output:
            while chunk := await file.read(READ_CHUNK_BYTES):
                size += len(chunk)
                if size > MAX_ITEM_PHOTO_BYTES:
                    raise problem(
                        413,
                        "item_photo_too_large",
                        "Item Photo is too large",
                    )
                output.write(chunk)
        if size == 0:
            raise problem(
                400,
                "validation_failed",
                "Validation failed",
                {"file": "must not be empty"},
            )
        photo = ItemPhoto(
            id=photo_id,
            item_id=item.id,
            storage_path=filename,
            content_type=content_type,
            size_bytes=size,
        )
        db.add(photo)
        await db.commit()
        await db.refresh(photo)
        return ItemPhotoEnvelope(item_photo=item_photo_response(photo))
    except Exception:
        if path.exists():
            path.unlink()
        raise


@router.delete(
    "/items/{item_id}/photos/{item_photo_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_item_photo(
    item_id: UUID,
    item_photo_id: UUID,
    db: DatabaseSession,
    current: AuthenticatedMutation,
    settings: AppSettings,
) -> None:
    item = await owned_item(db, item_id, current.user.id)
    photo = await owned_item_photo(db, item.id, item_photo_id, current.user.id)
    path = storage_path(settings, photo)
    await db.delete(photo)
    await db.commit()
    if path.exists():
        path.unlink()


@router.get("/item-photos/{item_photo_id}/content")
async def get_item_photo_content(
    item_photo_id: UUID,
    db: DatabaseSession,
    current: CurrentSessionDependency,
    settings: AppSettings,
) -> FileResponse:
    photo = await db.scalar(select(ItemPhoto).where(ItemPhoto.id == item_photo_id))
    if photo is None:
        raise problem(404, "item_photo_not_found", "Item Photo was not found")
    item = await db.get(Item, photo.item_id)
    if item is None:
        raise problem(404, "item_photo_not_found", "Item Photo was not found")
    can_view = item.owner_id == current.user.id
    if not can_view:
        can_view = (
            await db.scalar(
                select(ItemSharing.item_id)
                .join(
                    SharingGroupMember,
                    SharingGroupMember.sharing_group_id == ItemSharing.sharing_group_id,
                )
                .where(
                    ItemSharing.item_id == item.id,
                    SharingGroupMember.user_id == current.user.id,
                )
            )
            is not None
        )
    if not can_view:
        raise problem(404, "item_photo_not_found", "Item Photo was not found")
    path = storage_path(settings, photo)
    if not path.exists():
        raise problem(404, "item_photo_not_found", "Item Photo was not found")
    return FileResponse(path, media_type=photo.content_type)
