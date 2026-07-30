# We Share Stuff

Monorepo for **We Share Stuff** — a private inventory app that helps people organize physical things they own so those things can later be shared, borrowed, or made available to others.

This repository replaces the previous split remotes:

- [`we-share-stuff-backend`](https://github.com/captainDuckay/we-share-stuff-backend) (archived)
- [`we-share-stuff-frontend`](https://github.com/captainDuckay/we-share-stuff-frontend) (archived)

## Layout

```text
backend/     FastAPI + PostgreSQL API (uv, Alembic, Docker Compose)
frontend/    Angular app (pnpm)
```

There is no monorepo build framework (Nx, Turborepo, etc.). Each package keeps its own toolchain. CI and local commands stay package-scoped.

## Product and domain docs

Canonical product language and decisions live with the app docs today:

- [`frontend/CONTEXT.md`](./frontend/CONTEXT.md) — glossary and domain language
- [`frontend/docs/product-intent.md`](./frontend/docs/product-intent.md) — product direction and non-goals
- [`frontend/docs/architecture/seams.md`](./frontend/docs/architecture/seams.md) — architecture seams
- [`frontend/docs/decision-records/`](./frontend/docs/decision-records/) — decision history

## Local development

### Backend

```bash
cd backend
docker compose up --build
```

API: `http://localhost:8000`. See [`backend/README.md`](./backend/README.md) for non-Docker setup, env vars, and photo storage notes.

### Frontend

With the API running:

```bash
cd frontend
pnpm install
pnpm start
```

App: `http://localhost:4200`. Browser `/api` requests proxy to `http://localhost:8000`. See [`frontend/README.md`](./frontend/README.md).

### Tests

```bash
cd backend && uv run pytest
cd frontend && pnpm test
```

## Issues and planning

Product issues, cross-stack tracers, and planning live in **this** repository. Use labels such as `area:backend`, `area:frontend`, and `area:full-stack` when useful.

## History

Prior git history remains on the archived GitHub remotes above. This monorepo starts from a fresh import of the working trees.
