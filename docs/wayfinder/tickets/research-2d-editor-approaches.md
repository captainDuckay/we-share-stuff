---
id: wf-research-2d-editor
title: Research 2D vector editor approaches for Angular
type: research
status: closed
parent: wf-map-placement-surfaces
blocked_by: []
assignee: null
labels:
  - wayfinder:research
---

# Research 2D vector editor approaches for Angular

## Question

What established approaches fit a **schematic** Placement Surface editor (not CAD/WMS) in an Angular app?

Surface facts (not a product decision):

- SVG vs canvas vs libraries (e.g. rough drag/resize of rects, pan/zoom)
- Persistence-friendly scene graph shapes for slots vs non-linkable structural draws
- Accessibility and export-to-static-snapshot implications for borrower reveal
- Complexity cost vs building a minimal custom SVG editor

Write findings under a throwaway research path / branch and link from the resolution. Prefer high-trust primary sources and maintainability for this small product.

## Resolution

**Findings:** [`docs/research/2d-placement-surface-editor-approaches.md`](../../research/2d-placement-surface-editor-approaches.md)

**Gist:** For a schematic Placement Surface editor (labeled linkable slots + non-linkable structure) in this small Angular app, a **domain JSON scene graph rendered with custom SVG** is the best-fit established approach: Angular `attr.*` bindings, `viewBox` pan/zoom, Pointer Events + `getScreenCTM` for drag/resize, native SVG/`title`/ARIA a11y hooks, and snapshots as frozen domain JSON plus optional SVG string or PNG. Canvas (and Konva/Fabric) fit pixel-heavy design tools but reimpose hit-testing and accessibility costs; Angular CDK drag-drop is for HTML lists, not geometry editing. Prefer maintainable custom SVG over a heavy framework unless interaction scope grows far beyond axis-aligned regions.
