---
id: wf-map-placement-surfaces
title: Typical Placement surfaces design spec
type: map
status: open
parent: null
blocked_by: []
assignee: null
labels:
  - wayfinder:map
---

# Typical Placement surfaces design spec

## Destination

A product/design specification for richer **Typical Placement** via **Placement Surfaces**, **Placement Slots**, and **Structural Drawings**—domain language, ownership, visibility, lifecycle, and UX intent—ready to hand off to a later implement effort. Not the implementation itself.

## Notes

- **Domain:** We Share Stuff inventory + sharing. Glossary in [`CONTEXT.md`](../../../CONTEXT.md); location seam in [`docs/architecture/seams.md`](../../architecture/seams.md).
- **Skills every session should consult:** `domain-modeling`, `grilling`, `CONTEXT.md`, location seam, product-intent (no live tracking / warehouse posture).
- **Standing preferences from charting:**
  - Prefer domain term **Typical Placement**, never “current placement.”
  - Structured placement is **per Item** via optional link to a **Placement Slot**; free text remains when unlinked.
  - Surfaces may include **Placement Slots** (linkable) and **Structural Drawings** (visual only, never linked).
  - Many Surfaces per Typical Location; owner-only edit; post-acceptance reveal = that Item’s Slot + parent Surface (not full atlas).
  - Dimensions optional but preferred; labels are the findability contract.
  - Many Items may share one Slot; optional free-text note on the Item.
  - Delete blocked while referenced; owner edits live; accepted borrowers keep a readable snapshot.
- **Tracker:** local markdown — see [`docs/wayfinder/README.md`](../README.md).

## Decisions so far

<!-- index only — gist + link; detail lives on the closed ticket -->

- [Research 2D vector editor approaches for Angular](../tickets/research-2d-editor-approaches.md) — Custom SVG + domain JSON best fit for schematic slots/structure in Angular; canvas libraries overkill for v1-shaped surfaces

Charting session locked destination and frontier preferences above; they are orientation for tickets, not substitute for ticket resolutions where a ticket still asks a sharper question.

## Not yet specified

- Exact geometry primitives (axis-aligned rect only vs polygon/path) for Slots vs Structural Drawings
- Dimension units, validation, and how “preferred” dimensions surface in UX without blocking save
- Slot label uniqueness scope (per Surface vs per Location) and allowed label formats
- Concrete snapshot payload at acceptance (fields, immutability, cancel/re-accept)
- Borrower reveal presentation (static diagram crop vs interactive, accessibility)
- Owner editor entry points (My Page / Typical Location management vs Item editor)
- How Structural Drawings are layered/z-ordered relative to Slots in the editor and reveal
- Migration story for existing free-text `typical_placement` strings
- API and persistence shape (defer deep API until domain tickets settle)
- Whether a Slot may move between Surfaces

## Out of scope

- Live / current placement tracking and movement history
- Warehouse capacity, stock counts, pick paths, exclusive occupancy
- Household co-editing of layouts
- Photo-backdrop walls as required v1 (growth fog only)
- Mobile AR shelf pointing
- Auto-generating layouts from Item Photos
- Implementing the feature in this map (destination is the spec, not the build)
