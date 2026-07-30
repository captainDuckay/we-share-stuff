# We Share Stuff backend

FastAPI/PostgreSQL API for a private inventory MVP. Every inventory operation is
scoped to the signed-in account; account IDs are never accepted from clients.

## Local run

Start PostgreSQL and the API:

```bash
docker compose up --build
```

The API listens at `http://localhost:8000`. The frontend development server
proxies its same-origin `/api` requests to this port. Copy `.env.example` to
`.env` for a non-Docker local setup, run `alembic upgrade head`, then start
Uvicorn with `uv run uvicorn app.main:app --reload`.

## Persistent photos

Item Photo, Profile Photo, and Sharing Group Photo metadata is stored in PostgreSQL and the
image files are stored on disk. Docker Compose mounts the `item_photo_data`,
`profile_photo_data`, and `sharing_group_photo_data` named volumes at `/data/item-photos`,
`/data/profile-photos`, and `/data/sharing-group-photos`, so uploads survive API restarts,
image rebuilds, and container replacement. PostgreSQL continues to use the separate
`postgres_data` volume.

Before recreating an API container that already has uploads from the old
configuration, copy `/app/var/item-photos` out of that container and copy its
contents into `/data/item-photos` after starting this configuration. Otherwise,
recreating that old container will discard its unmounted files.

Do not use `docker compose down --volumes` (or `down -v`) unless both database
and uploaded-photo data should be deleted. Back up all photo volumes together with the PostgreSQL volume when backing up an installation. Files that were already lost from an earlier
container cannot be recovered from their remaining database metadata.

For a non-Docker deployment, set `ITEM_PHOTO_STORAGE_DIR`, `PROFILE_PHOTO_STORAGE_DIR`,
and `SHARING_GROUP_PHOTO_STORAGE_DIR` to persistent, writable directories on the local
machine. The `var/item-photos`, `var/profile-photos`, and `var/sharing-group-photos` defaults
are intended for development and are ignored by Git.

Run checks with:

```bash
uv sync --all-groups
uv run ruff check .
uv run pytest -q
```

## API session security

Authentication uses an opaque, server-side seven-day session. The `wss_session`
cookie is host-only, `HttpOnly`, `SameSite=Lax`, and scoped to `/api`; it is
Secure when `COOKIE_SECURE=true`. Local HTTP development explicitly uses
`COOKIE_SECURE=false`; production configuration refuses that value.

`XSRF-TOKEN` is a separate readable cookie. Clients must send its value in the
`X-XSRF-TOKEN` header for every POST, PATCH, and DELETE request. The API also
checks unsafe-request Origins against `FRONTEND_ORIGINS`. Auth/session and
inventory responses are `Cache-Control: no-store`.

Endpoints are rooted at `/api`: auth registration, sign-in, sign-out, and
session restoration live under `/api/auth`; private item CRUD lives at
`/api/items`. API errors use `application/problem+json` with stable codes.
