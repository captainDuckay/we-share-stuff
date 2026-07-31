# Wayfinder notes (local drafts)

**Canonical tracker is GitHub Issues.** See [`docs/agents/issue-tracker.md`](../agents/issue-tracker.md) for wayfinding operations (`wayfinder:map`, child tickets, dependencies, claim/resolve).

## Maps

**[Typical Placement surfaces design spec](https://github.com/captainDuckay/we-share-stuff/issues/1)** (`wayfinder:map`) — **complete**

- **Handoff spec:** [`docs/design/typical-placement-surfaces.md`](../design/typical-placement-surfaces.md)
- Durable rules: [`CONTEXT.md`](../../CONTEXT.md), location seam in [`docs/architecture/seams.md`](../architecture/seams.md)

Do not treat files under `docs/wayfinder/maps/` or `docs/wayfinder/tickets/` as source of truth. They were early local drafts before GitHub labels and issues were available; prefer the linked GitHub issues and the design doc.

## Labels

| Label | Role |
|-------|------|
| `wayfinder:map` | Map issue |
| `wayfinder:research` | AFK research ticket |
| `wayfinder:prototype` | HITL prototype ticket |
| `wayfinder:grilling` | HITL grilling ticket |
| `wayfinder:task` | Task that unblocks a decision |
