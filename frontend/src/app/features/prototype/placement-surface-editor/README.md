# PROTOTYPE · Owner Placement Surface editor

**Wayfinder ticket:** [#7 Owner Placement Surface editor intent](https://github.com/captainDuckay/we-share-stuff/issues/7)  
**Branch:** `prototype/placement-surface-editor` (throwaway — not product on `main`)

## Question

What should the owner's 2D builder *feel* like at low fidelity?

## Run

From `frontend/`:

```bash
pnpm prototype:placement-surface-editor
```

Or with a normal serve:

```bash
pnpm start
```

Open: [http://127.0.0.1:4200/prototype/placement-surface-editor?variant=A](http://127.0.0.1:4200/prototype/placement-surface-editor?variant=A)

## Variants (`?variant=` or bottom bar / ← →)

| Key | Name | Structural idea |
| --- | --- | --- |
| **A** | Tool palette + tabs | Desktop schematic: surface tabs, draw modes, side properties |
| **B** | Surface cards → sketch | Manage surfaces as cards first; full-bleed sketch second |
| **C** | Label-first inventory | Slot labels lead; canvas is a supporting map |

Shared in-memory scene (reload wipes). Geometry/labels match decisions from tickets #2 and #4 at product level only.

## Not product

No auth, no API, no tests. Capture the verdict on the issue; keep this code on the throwaway branch.
