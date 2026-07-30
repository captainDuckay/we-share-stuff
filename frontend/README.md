# We Share Stuff

Private user inventory MVP built with Angular 22 and the sibling FastAPI service.

## Product and domain docs

Product docs live at the monorepo root (not frontend-specific):

- [`CONTEXT.md`](../CONTEXT.md) — glossary and canonical domain language.
- [`docs/product-intent.md`](../docs/product-intent.md) — product direction, non-goals, and feature-fit criteria.
- [`docs/architecture/seams.md`](../docs/architecture/seams.md) — domain and architecture seams to preserve while implementing features.
- [`docs/decision-records/0001-domain-grilling.md`](../docs/decision-records/0001-domain-grilling.md) — question-and-answer record of the domain grilling session.

Current implementation is intentionally User-bound. Do not add Household-bound product logic until household collaboration becomes an implemented feature.

## Run locally

Start the backend from `../backend` with `docker compose up --build`.
Then run this application:

```bash
pnpm start
```

The development server is at `http://localhost:4200`; browser-visible `/api` requests proxy to `http://localhost:8000`.

```bash
pnpm test
pnpm build
```

Smoke test: register, refresh to restore the cookie session, add/edit/delete an item, then sign out. The API owns authentication and item authorization; the frontend stores no session token.
