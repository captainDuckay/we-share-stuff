# Domain and Architecture Seams

This document records the seams features should respect as We Share Stuff grows. [`CONTEXT.md`](../../CONTEXT.md) at the repository root defines the glossary; this file explains where responsibilities should split.

The foundational question-and-answer history behind these seams is recorded in [`../decision-records/0001-domain-grilling.md`](../decision-records/0001-domain-grilling.md). My Page and User identity decisions are recorded in [`../decision-records/0003-my-page.md`](../decision-records/0003-my-page.md).

## Current accountability seam

For now, product behavior is User-bound.

- User owns Items.
- User has an Inventory.
- User creates Sharing Groups.
- User joins Sharing Groups.
- User shares Items.
- User requests and accepts Reservations.
- User is accountable for Borrowing.

Do not add Household-bound product logic yet. Household is descriptive context only until the product supports real household collaboration.

A User's Display Name and optional Profile Photo are visible to current Members of a common Sharing Group and to the other party in an existing Reservation Request. Reservation history preserves this identity visibility after group membership ends. Do not expose email addresses as User identity or add global User discovery.

Avoid for now:

- `householdId` on core records
- `HouseholdStore`
- `HouseholdService`
- household authorization logic
- "household inventory" user-facing language

## Inventory seam

Inventory is the User's private collection of Items.

The current private inventory can remain lightweight. Do not force sharing concepts into private inventory before the sharing boundary needs them.

Private Items may exist without:

- Typical Location
- Typical Placement
- Item Photos
- Sharing Group membership
- Reservation state

## Category seam

A Category is a reusable classification for Items.

An Item may have zero or more Categories.

Categories are canonicalized for matching and persistence using lowercase text. User-facing Category display capitalizes the first letter.

Categories are discovered from existing known Categories and may be created when a User enters a new Category while creating or editing an Item.

Do not model arbitrary free-form tags yet. Categories are reusable classifications with canonical matching, not an unconstrained tag vocabulary.

## Location seam

Use Typical Location and Typical Placement deliberately.

### Typical Location

A reusable saved place belonging to a User where Items are normally kept.

Typical Location is not live tracking. It is where the User normally expects the Item to be. It may later contain address fields, map coordinates, and timezone.

An Item must have a Typical Location before it can be shared.

### Typical Placement

An Item-specific precise placement within a Typical Location.

Typical Placement is either:

- a link to a Placement Slot (plus optional free-text note), when the owning User has linked the Item; or
- free text only, when the Item is not linked to a slot (including when Placement Surfaces exist on the Location but this Item is not linked).

Typical Placement is optional and encouraged, not required. It is hidden from other Users until a Reservation is accepted.

### Placement Surface and Placement Slot

A Placement Surface is a drawable 2D surface under a Typical Location (for example one wall of storage). A Location may have many Surfaces.

On a Surface:

- **Placement Slots** are labeled, addressable regions. Many Items may share one Slot.
- **Structural Drawings** are non-addressable geometry for visual structure only; they cannot be linked as Typical Placement and have no user-facing label.

Geometry model (product level, not API schema):

- Sketch plane is **infinite** (pan/zoom); the owner does not set a surface canvas size. Surface extent is **derived** from structure + slots.
- World units are **millimetres** (one model for geometry and size fields—not abstract units with a separate scale).
- Placement Slots are axis-aligned rectangles only.
- Structural Drawings are axis-aligned rectangles or lines/polylines only.
- Slot width/height in the detail UI and rectangle size on the sketch are the **same values** (edit either; the other updates).
- Fixed draw order: Structural Drawings behind, Placement Slots in front.
- Refines geometry ticket #2: drops “abstract unit canvas + optional surface physical size as scale” in favor of mm-native infinite plane.

Label and identity (product level):

- A Placement Slot has a stable system id separate from its human label; Item links use the id so rename does not break links.
- Slot labels are free text (trimmed, non-empty, soft max length)—no warehouse code scheme.
- Labels are unique per Typical Location (case-insensitive), not merely per Surface; create/rename that would collide is rejected.
- Slot labels are the only address language on a Surface; Structural Drawings do not carry user-facing names.

Owner editor intent (product level, from prototype #7):

- Multiple Surfaces via **tabs** under the Typical Location.
- Draw tools live **inside** the sketch window as a vertical icon rail (Photoshop-like), not a CAD ribbon outside the sketch.
- Wheel zoom and pan on the infinite plane; schematic (not warehouse CAD).

Only the owning User of the Typical Location edits Surfaces, Slots, and Structural Drawings. Members never edit them.

After Reservation acceptance, the borrowing User may see the Item's Placement Slot plus its parent Placement Surface—not the owner's full multi-surface atlas. Unrelated Surfaces and the editor remain private.

Hard delete of a Slot or Surface is blocked while any Item still references a Slot on it (reassign first). Rename/move/resize stays live for the owner; accepted borrowers keep a readable placement snapshot (at least label and Surface name).

Avoid naming these concepts as current location, geo-location, address, warehouse map, or live tracking in domain language.

## Sharing Group seam

A Sharing Group is a mutual relationship space between Users.

- A User creates a Sharing Group.
- The creating User manages membership for now.
- Membership is invitation-only.
- Any Member may share their own Items into the Sharing Group.
- A Sharing Group does not own Items.
- A Sharing Group may have one Sharing Group Photo.

A Sharing Group Photo may contain photographic or logo-like artwork; those are not separate domain concepts. When a Sharing Group has no photo, clients may provide their own generic placeholder. Placeholder icons are presentation details and are not persisted or exposed by the API.

Avoid modeling a Sharing Group as a container that owns Items. Items remain owned by their owning User.

## Item sharing seam

Sharing is a binary relationship between an Item and a Sharing Group.

An Item is either shared or not shared with a Sharing Group. Do not add draft, paused, published, hidden, or per-group item overrides until users prove they are needed.

A Shared Item exposes the same Item data in every Sharing Group where it is shared. Per-group sharing only changes visibility, not Item content.

Avoid per-group overrides such as:

- description override
- photo override
- location override
- custom group-specific listing text

## Shared Item requirements

An Item must have the following before it can be shared:

- basic Item details
- Typical Location

Item Photos are optional. Adding or deleting Item Photos does not change whether an Item is ready to share and does not change existing sharing. When an Item has no photo, clients may provide their own generic placeholder. Placeholder icons are presentation details and are not persisted or exposed by the API.

Members of a Sharing Group can see a Shared Item's:

- basic details
- Item Photos
- availability / reservation state
- full Typical Location

Members cannot see Typical Placement until their Reservation is accepted.

## Shared Item discovery seam

Shared Item discovery is global from the viewing User's perspective.

A User may find Shared Items through:

- global Browse shared items, which combines all Shared Items visible through any Sharing Group the User belongs to;
- a Sharing Group page, which shows the Shared Items visible in that relationship space;
- global Shared Item detail, which is about the Item and involved Users rather than about one Sharing Group.

If the same Item is visible through multiple Sharing Groups, global Browse shared items should show it once and list the Sharing Groups through which the viewing User can see it.

The User's own Shared Items are included in discovery and marked as theirs. This helps the User understand what is visible in their sharing network.

Avoid modeling discovery as if a Sharing Group owns or contains Items. Sharing Groups explain visibility; Items remain owned by Users.

## Reservation Request seam

A Reservation Request is a User's request to borrow someone else's Shared Item for a date-time range.

A Reservation Request is between:

- the requesting User;
- the owning User;
- the Item.

A Reservation Request is not conceptually associated with a Sharing Group. Sharing Groups explain why the requesting User could see the Shared Item at request time, but the borrowing claim itself is not made through a Sharing Group.

Implementation note: backend persistence may temporarily keep a Sharing Group reference as visibility provenance while older grouped routes are migrated. Treat that field as transitional/audit context, not as the domain owner or scope of the Reservation Request.

Reservation Request lifecycle:

- `pending` — waiting for the owning User to accept or decline;
- `accepted` — the same Reservation Request has become an Accepted Reservation;
- `declined` — the owning User rejected the pending request;
- `withdrawn` — the requesting User ended the pending request;
- `cancelled` — an accepted request was ended by either involved User.

Pending Reservation Requests do not block overlapping requests. Only Accepted Reservations block conflicting accepted claims.

Existing Reservation Requests remain visible and actionable if the Item is later unshared or if the requester later loses Sharing Group visibility. Visibility at request time is enough to keep the request valid. Unsharing stops new discovery and requestability; it does not erase or cancel existing requests.

## Accepted Reservation seam

An Accepted Reservation is a Reservation Request in the `accepted` state.

Accepted Reservations:

- block conflicting Reservation Requests from being accepted;
- reveal Typical Placement to the borrowing User;
- remain the same record as the original Reservation Request;
- do not introduce pickup, return, completion, or current-borrowing workflow yet.

If an Accepted Reservation is cancelled:

- it no longer blocks conflicts;
- it no longer reveals Typical Placement to the borrowing User;
- it does not become completed or returned.

Current, past, and upcoming borrowing labels should be derived from the accepted date-time range, not from extra lifecycle statuses.

Keep Reservation separate from Borrowing. A Reservation is a planned and approved claim. Borrowing is the broader domain concept of temporary use without payment.

## Reservation Change Proposal seam

A Reservation Change Proposal is a proposed change to a Reservation Request's date-time range.

Either involved User may propose one before or after acceptance. The other involved User must approve the proposal before it changes the Reservation Request.

Proposal lifecycle:

- `pending` — waiting for the other involved User to approve or reject;
- `approved` — the proposed range was applied to the Reservation Request;
- `rejected` — the original Reservation Request remains unchanged;
- `void` — the underlying Reservation Request ended before the proposal could be resolved.

Rules:

- Only one proposal may be pending for a Reservation Request at a time.
- Proposed ranges cannot be in the past.
- Proposed ranges cannot conflict with another Accepted Reservation.
- For an already accepted Reservation Request, its own current accepted range does not count as a conflict against itself.
- Approving a proposal on a pending Reservation Request updates the requested date-time range but leaves the request pending.
- Approving a proposal on an accepted Reservation Request updates the accepted date-time range and keeps it accepted.
- Rejecting a proposal does not decline, withdraw, cancel, or otherwise end the underlying Reservation Request.
- All proposals remain visible as history to the requesting User and owning User only.

## Reservation time seam

Reservation time is location-local.

The Typical Location timezone owns the meaning of Reservation start and end time. The system may store UTC instants internally, but the domain meaning is the local time at the Item's Typical Location.

When implemented, prefer storing:

- start instant in UTC
- end instant in UTC
- timezone from the Typical Location

Primary user-facing display should use the Typical Location timezone. Viewer-local helper text may be added, but viewer timezone should not define the Reservation.

## Membership lifecycle seam

If a User leaves or is removed from a Sharing Group, their Items stop being shared with that Sharing Group.

Membership loss stops future visibility through that Sharing Group. It does not erase Reservation Requests that were already created while the requesting User had visibility. Existing Reservation Requests remain visible and actionable for the requesting User and owning User.

## Delete and unshare seam

Unsharing an Item stops new visibility and requestability through that Sharing Group. It should not cancel existing Reservation Requests or already Accepted Reservations.

Deleting an Item should be blocked or soft-deleted while future Accepted Reservations exist.

## Future seams intentionally deferred

Do not model these yet:

- Household collaboration
- multiple Users per Household
- item tags
- public group discovery
- availability calendars
- pickup/return tracking
- payment, rental, sale, or marketplace concepts
