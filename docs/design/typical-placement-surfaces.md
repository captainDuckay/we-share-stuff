# Design: Typical Placement Surfaces

## Purpose & destination

This document is the **product/design specification** for richer **Typical Placement** via **Placement Surfaces**, **Placement Slots**, and **Structural Drawings**.

It is the handoff artifact from the wayfinder map [Typical Placement surfaces design spec](https://github.com/captainDuckay/we-share-stuff/issues/1). It is ready for a later **implement** effort. It is **not** the implementation plan, API design, or ticket breakdown.

**Canonical durable homes (do not fork these here):**

- Glossary: [`CONTEXT.md`](../../CONTEXT.md)
- Seam rules: [`docs/architecture/seams.md`](../architecture/seams.md) (Location seam)
- Product posture: [`docs/product-intent.md`](../product-intent.md)

This design doc is the implementer-facing **synthesis**: domain model, UX intent, visibility, lifecycle, non-goals, and what remains open for implement.

---

## Domain language

Canonical definitions live in [`CONTEXT.md`](../../CONTEXT.md). Terms this feature uses:

| Term | Role in this feature |
|------|----------------------|
| **Typical Location** | Owner-owned place; parent of many Placement Surfaces |
| **Typical Placement** | Per-Item precision within a Location: Slot link + optional note, or free text only |
| **Placement Surface** | Drawable 2D surface under a Location (e.g. a wall of storage) |
| **Placement Slot** | Labeled, addressable region on a Surface; Items may link to it |
| **Structural Drawing** | Non-addressable geometry for visual structure only; never linkable |

Prefer **Typical Placement**, never “current placement.” Avoid warehouse / live-tracking language for these concepts.

---

## Product model

### Ownership and cardinality

- Only the **owning User** of a Typical Location creates and edits Surfaces, Slots, and Structural Drawings. Members never edit them.
- A Typical Location may have **many** Placement Surfaces.
- A Surface may contain many Placement Slots and many Structural Drawings.
- **Many Items may share one Slot.** Linking is optional per Item; Surfaces may exist without any Item links.
- Structured placement is **per Item** via an optional link to a Placement Slot; free text remains when unlinked.

### Geometry (product level, not API schema)

Refines early geometry discussion: the sketch is **millimetre-native** on an **infinite** plane (not abstract units with a separate scale).

- Owner does **not** set a fixed canvas size; Surface **extent is derived** from structure + slots.
- **Placement Slots:** axis-aligned rectangles only (`x`, `y`, width, height in mm). No rotation or polygons in this commitment.
- **Structural Drawings:** axis-aligned rectangles or lines/polylines only. No freehand, ellipses, beziers, or non-slot text annotations in this commitment.
- Slot width/height in detail UI and rectangle size on the sketch are the **same values** (edit either; the other updates).
- **Fixed draw order:** Structural Drawings behind → Placement Slots in front (labels on slots as presentation). No free z-index stacking.
- Optional preferred dimensions may appear when already present on Surface/Slot; they do not block save or invent a second coordinate system.

### Label and identity

- A Placement Slot has a **stable system id** separate from its human label. Item links use the id so rename does not break links.
- Slot labels are **free text** (trimmed, non-empty, soft max length)—no warehouse code scheme.
- Labels are **unique per Typical Location** (case-insensitive), not merely per Surface; create/rename that would collide is rejected.
- Slot labels are the **only address language** on a Surface. Structural Drawings have **no user-facing labels**.

### Item Typical Placement shape

Typical Placement on an Item is either:

1. **Linked:** Placement Slot (stable id) + optional free-text note; or  
2. **Free text only:** when no Slot is linked (including when Surfaces exist on the Location but this Item is not linked); or  
3. **Empty:** allowed and encouraged to fill later, never required.

Typical Placement is optional and encouraged, not required for sharing or acceptance.

---

## UX intent

### Owner: Placement Surface editor

- **Entry:** My Page → Typical Location management (“Manage surfaces…”). The Item editor is **not** the primary place to design Surfaces.
- **Multiple Surfaces:** tabs under the Typical Location.
- **Tools:** vertical icon rail **inside** the sketch window (schematic, not a CAD ribbon outside the sketch).
- **Canvas:** infinite mm plane; wheel zoom and pan; content-derived extent.
- **Assign Items to Slots** from both:
  1. Canvas / surface page details (slot selected on the sketch), and  
  2. Item editor (Typical Placement link).

Same link relationship either way.

**Research orientation (not a hard library choice):** schematic editing in this Angular app fits a **domain JSON scene graph + custom SVG** better than heavy canvas frameworks. See [Research: 2D Placement Surface editor approaches](../research/2d-placement-surface-editor-approaches.md). Prototype exploration: branch `prototype/placement-surface-editor`.

### Owner: Item create/edit (Typical Placement)

- **Free-text first.** Linking a Slot is an optional upgrade; never required because Surfaces exist.
- **On link:** existing free text becomes the optional note; the Slot is the primary address.
- **On unlink:** explicit control drops the Slot; the note becomes free-text Typical Placement again (no confirm).
- **On Typical Location change or clear:** auto-clear the Slot link; keep the note as free text; soft notice that the slot was cleared. Do not block the Location change; do not re-link by matching labels on the new Location.
- **Slot → Slot:** keep the note.
- **Soft suggestions:** when the Location has slots, compact label list/chips (Surface secondary). Choosing one upgrades to a link. Free text stays primary; never force browse.
- **Picker:** label-first, scoped to this Location; optional light parent-Surface preview with the Slot highlighted. No embedded surface editor in the Item flow.

### Borrower: reveal after acceptance

Read-only projection of the **frozen snapshot**, not the owner editor.

- **Structured diagram:** full **parent Placement Surface** with the **linked Slot strongly highlighted**. Other slots on that Surface as quiet outlines with labels (orientation only). Structural Drawings 1:1 in structure style; never selectable. **No co-located Items** on the diagram.
- **Interaction:** pan and zoom only. Initial framing **fits the entire parent Surface**; highlight locates the target Slot.
- **Required text path** (always present when structured, including for assistive tech): **Surface name → Slot label**, plus optional Item note when present. Diagram supports that path; it does not replace it.
- **Free-text-only / empty:** show frozen string or “No Typical Placement has been noted.”—**without diagram chrome**. Do not invent structure from free text.

---

## Visibility & trust

Aligned with existing sharing posture in product intent and seams:

- **Before** Reservation acceptance: Members see full Typical Location, **not** Typical Placement.
- **After** acceptance: borrowing User sees a **frozen snapshot** of that Item’s placement only—linked Slot + **parent Surface**, not the owner’s full multi-surface atlas.
- Unrelated Surfaces and the owner editor remain private.
- **Cancel** stops reveal (placement hidden again).
- Owner inventory and Surfaces stay **live**; owner mid-accept edits do **not** rewrite the borrower’s snapshot.

---

## Lifecycle

### Snapshot at acceptance

- **Freeze at accept** for the life of that Accepted Reservation.
- **Structured (Slot-linked):** Surface name, Slot label, optional Item free-text note, Slot geometry (mm rect), Structural Drawings on that parent Surface only; optional preferred dimensions when already present. Other Surfaces and co-located Items out. Internal ids may be stored; borrower findability uses frozen labels.
- **Free-text-only:** freeze that string the same way.
- **Empty:** freeze empty (do not invent structure).
- **Cancel:** hide reveal.
- **Re-accept:** capture a **fresh** snapshot.
- **Reservation Change Proposal** (date-time only): **keep** the existing snapshot.

### Delete and reassign (owner structure)

- **Slot hard-delete blocked** while any Item still links to that Slot. No silent unlink, bulk detach, or inventing free text from the Slot label.
- **Surface hard-delete blocked** while any Item links to **any** Slot on that Surface.
- **Structural Drawings** always free to hard-delete (never linkable).
- **Unreferenced** Slots and Surfaces hard-delete freely (optional confirm only).
- When delete is blocked: show **linked Item count** and **“View items”** (Inventory filtered to those Items / that Slot). Owner reassigns or unlinks **one-by-one** via existing flows. **No bulk reassign wizard** in this commitment.
- **Live edits always allowed** for the owner (including while Items link and Accepted Reservations exist): rename Surface/Slot label; move/resize Slot geometry; edit Structural Drawings. Links use stable Slot id; borrowers keep snapshots.
- **Re-parent a Slot** between Surfaces under the **same** Typical Location is allowed (stable id and links stay; geometry travels as-is). **Not** across Typical Locations.
- **Accepted Reservations add no extra structure lock.** Snapshots are copies, not FKs that keep live structure alive. After no live links remain, structure may be deleted even if borrowers still hold snapshots.
- When a Surface is free to delete, hard-delete **cascades** all child Slots and Structural Drawings. If any Slot is still linked, Surface delete is **fully blocked** (no partial cascade).

---

## Non-goals

Out of scope for this design and for v1 of the feature intent:

- Live / current placement tracking and movement history
- Warehouse capacity, stock counts, pick paths, exclusive occupancy
- Household co-editing of layouts
- Photo-backdrop walls as required v1
- Mobile AR shelf pointing
- Auto-generating layouts from Item Photos
- Payments, marketplace, or logistics tracking (broader product non-goals)

Also out of the **geometry** commitment: rotated/polygonal slots, freehand structure, free z-index stacking, mm-forcing that blocks rough sketching via a second unit system (this design uses mm-native infinite plane instead of dual scale).

---

## Open for implement

Do **not** treat these as product/design gaps on the wayfinder map. They belong to a later implement effort:

| Area | Notes |
|------|--------|
| **API / persistence shape** | Endpoints, payloads, versioning, store layout |
| **Migrations** | Existing free-text `typical_placement` strings; backfill strategy |
| **Ticket / PR breakdown** | Sequencing, vertical slices, estimation |
| **Frontend module architecture** | Exact Angular structure beyond the research gist (custom SVG + domain JSON) |
| **Snapshot storage format** | Exact JSON/blob shape for frozen borrower payload |
| **Performance / a11y engineering** | Concrete ARIA trees, virtualization, etc. beyond product intent above |
| **Test strategy & CI** | Unit vs e2e cut, fixtures |

Product rules above are binding for implement; storage and API may change as long as behavior matches.

---

## Sources

| Source | What it holds |
|--------|----------------|
| [Typical Placement surfaces design spec](https://github.com/captainDuckay/we-share-stuff/issues/1) | Wayfinder map (index) |
| [Geometry model for Placement Slots and Structural Drawings](https://github.com/captainDuckay/we-share-stuff/issues/2) | Primitives and layering (later refined to mm-native infinite plane in seams + editor work) |
| [Research 2D vector editor approaches for Angular](https://github.com/captainDuckay/we-share-stuff/issues/3) | Tech orientation → [`docs/research/2d-placement-surface-editor-approaches.md`](../research/2d-placement-surface-editor-approaches.md) |
| [Placement Slot labels and identity rules](https://github.com/captainDuckay/we-share-stuff/issues/4) | Stable id, uniqueness, no structure labels |
| [Placement snapshot when a Reservation is accepted](https://github.com/captainDuckay/we-share-stuff/issues/5) | Freeze / cancel / re-accept / change proposal |
| [Borrower reveal of Slot and parent Surface](https://github.com/captainDuckay/we-share-stuff/issues/6) | Diagram + text path presentation |
| [Owner Placement Surface editor intent](https://github.com/captainDuckay/we-share-stuff/issues/7) | Editor feel, entry, dual assign paths; prototype branch `prototype/placement-surface-editor` |
| [Item Typical Placement linking vs free text](https://github.com/captainDuckay/we-share-stuff/issues/8) | Free-text first, note rules, picker |
| [Delete and reassign lifecycle for Surfaces and Slots](https://github.com/captainDuckay/we-share-stuff/issues/9) | Block delete while linked, cascade, re-parent |
| [Spec document shape and handoff](https://github.com/captainDuckay/we-share-stuff/issues/10) | This document’s shape and map done criteria |
| [`docs/architecture/seams.md`](../architecture/seams.md) | Durable location / placement seam rules |
| [`CONTEXT.md`](../../CONTEXT.md) | Glossary |
