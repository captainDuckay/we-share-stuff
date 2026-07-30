# Research: 2D Placement Surface editor approaches (Angular)

**Ticket:** [wf-research-2d-editor](../wayfinder/tickets/research-2d-editor-approaches.md)  
**Map:** [wf-map-placement-surfaces](../wayfinder/maps/typical-placement-surfaces-spec.md)  
**Date:** 2026-07-30  
**Scope:** Established approaches for a *schematic* Placement Surface editor (labeled Placement Slots + non-linkable Structural Drawings) in the Angular frontend. Not CAD/WMS. Not an implementation decision for domain geometry or API shape.

**Product context (orientation only):** Frontend is Angular 22 (`frontend/package.json`) with a deliberately small dependency set. Prefer maintainability over heavy graphics frameworks.

---

## Question

What established approaches fit a schematic Placement Surface editor in an Angular app?

Surface facts covered:

1. SVG vs canvas vs libraries (drag/resize of rects, pan/zoom)
2. Persistence-friendly scene graph shapes (slots vs structural drawings)
3. Accessibility and export-to-static-snapshot implications for borrower reveal
4. Complexity cost vs a minimal custom SVG editor

---

## Executive synthesis

| Approach | Fit for schematic slots + structure | Maintainability for this product | Notes |
| --- | --- | --- | --- |
| **Custom SVG + Angular templates** | Strong | Strong | DOM nodes = hit targets; `attr.*` binding for geometry; `viewBox` for pan/zoom; native a11y hooks |
| **Custom canvas (2d context only)** | Weak–medium | Weak | Immediate-mode bitmap; hit-testing and a11y are reimplemented; good for pixels/games, not labeled regions |
| **Canvas scene libraries (Konva, Fabric)** | Strong for interaction chrome | Medium–weak | Drag/resize/export built in; own scene model; larger dep + Angular lifecycle friction; a11y still custom |
| **SVG helper libraries (SVG.js)** | Medium | Medium | Imperative SVG API; competes with Angular’s template ownership |
| **Angular CDK drag-drop** | Poor for geometry | N/A as sole solution | Designed for free-drag / reorderable *HTML* lists, not SVG coordinate editing or resize handles |
| **Heavy diagram / CAD stacks** | Overfit | Poor | Wrong problem class (warehouse/CAD/WMS posture) |

**Best-fit pattern for this problem class:** keep a **domain scene model in TypeScript/JSON** (slots vs structural drawings as separate kinds), **render with SVG** bound from Angular, handle pointer interactions with the **Pointer Events** model, pan/zoom via **`viewBox`** (and/or a transform group), and produce borrower snapshots either as **serialized SVG** or a **raster export** (SVG → canvas → PNG/blob) depending on immutability needs. Defer canvas libraries unless interaction requirements grow far beyond axis-aligned rects + simple structure paths.

This is a research fit assessment, not a product commitment.

---

## 1. SVG vs canvas (platform facts)

### 1.1 SVG is a retained scene graph in the DOM

SVG is an XML-based language for vector graphics. A document is composed of structural containers (`svg`, `g`, …) and graphics elements (`rect`, `path`, `line`, `text`, …). Grouping is first-class via `<g>`; transforms and many presentation attributes inherit to children. See MDN’s SVG introduction and the SVG 2 document structure chapter.

- MDN SVG intro: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Introduction  
- SVG 2 structure (`g`, graphics elements, `title`/`desc`): https://www.w3.org/TR/SVG2/struct.html  
- MDN `<g>`: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/g  

Implications for Placement Surfaces:

- Each **Placement Slot** can be one (or a few) real DOM elements (e.g. `<rect>` + label `<text>`), addressable for hit-testing, focus, and ARIA.
- **Structural Drawings** can live in a separate `<g>` layer (draw order = paint order), never wired as link targets.
- Labels are first-class (`text` or HTML via `foreignObject`), matching the product’s “labels are the findability contract.”

### 1.2 Canvas is an immediate-mode bitmap

The Canvas API draws into a resolution-dependent bitmap via JavaScript (`getContext('2d')`, WebGL, etc.). The HTML Standard and MDN both stress that the canvas **does not expose drawn objects** to accessibility tools the way semantic markup does; authors must supply fallback content that conveys the same function, and for keyboard use map interactive regions to focusable fallback.

- MDN Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API  
- MDN `<canvas>` (accessibility: “just a bitmap… not exposed to accessibility tools as semantic HTML”; prefer avoid for accessible apps without extra work): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas  
- HTML Standard canvas element (fallback content; keyboard via focusable descendants of fallback): https://html.spec.whatwg.org/multipage/canvas.html#the-canvas-element  

Implications:

- Drag/resize/select require a **separate scene graph in JS** plus manual hit-testing (or a library that owns that graph).
- Borrower “read this diagram” UX either needs a parallel HTML/text representation or a static image with text alternatives—never free from the canvas itself.
- Raster export (`toDataURL` / `toBlob`) is native and simple; vector persistence is not.

### 1.3 Pan / zoom primitives

**SVG `viewBox`** defines the user-space rectangle mapped to the viewport; changing `min-x`/`min-y` pans, changing width/height zooms (with `preserveAspectRatio` controlling letterboxing).

- MDN `viewBox`: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox  
- Spec: https://w3c.github.io/svgwg/svg2-draft/coords.html#ViewBoxAttribute  

Pointer coordinates map to SVG user space via transformation matrices (`getScreenCTM()`, inverse mapping of client points)—standard for implementing drag in SVG user units under pan/zoom.

- MDN `getScreenCTM()`: https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getScreenCTM  

**Canvas** pan/zoom is an application transform (`setTransform` / matrix stack) applied before redraw; every frame (or dirty region) must repaint. No built-in hit graph.

### 1.4 Pointer interaction (shared)

Pointer Events unify mouse/touch/pen for `pointerdown` / `pointermove` / `pointerup` (with capture semantics useful for drag). Baseline for custom drag handles on either SVG elements or an overlay.

- MDN `pointerdown`: https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event  
- Spec: https://w3c.github.io/pointerevents/  

### 1.5 When each wins (for *this* schematic editor)

| Need | SVG | Canvas |
| --- | --- | --- |
| Few–hundred labeled regions | Natural | Overkill machinery |
| Hit-test without custom spatial index | Browser DOM | Manual / library |
| Screen reader / keyboard on slots | Title/ARIA/`tabindex` on nodes | Parallel UI or fallback tree |
| Crisp resize at any zoom | Vectors | Bitmap scaling / redraw |
| Thousands of animated particles | Weak | Strong |
| Photo filters / pixel ops | Weak | Strong |
| Static PNG snapshot | Extra step (draw SVG→canvas) | Built-in `toBlob`/`toDataURL` |

For schematic Placement Surfaces (owner edits slots/structure; borrower sees slot + parent surface snapshot), **SVG’s retained DOM matches the domain objects 1:1**. Canvas is justified mainly if performance of many moving bitmaps becomes the bottleneck—which is outside the stated non-goals (no live warehouse tracking).

---

## 2. Angular integration facts

### 2.1 Binding SVG geometry from templates

Angular’s binding guide documents that attributes without corresponding DOM properties—**explicitly including SVG attributes**—are set with the `attr.` prefix (e.g. `[attr.x]`, `[attr.viewBox]`). Property bindings update DOM properties; attribute bindings call `setAttribute` / `removeAttribute`.

- https://angular.dev/guide/templates/binding  

Historical Angular docs also document SVG as templates (directives and bindings on SVG the same as HTML), e.g. archived guide: https://v17.angular.io/guide/svg-in-templates  

**Practical pattern:** component owns a signals/model array of slots and drawings; template `@for`s `<rect>` / `<path>` / `<text>` with `[attr.x]` etc.; pointer handlers update the model; change detection re-renders. No second scene graph library required for v1-shaped surfaces.

### 2.2 Accessibility tooling Angular already documents

Angular’s a11y guide: bind ARIA with normal attribute/property bindings; prefer reusing native interactive elements; CDK `a11y` (LiveAnnouncer, focus trap); headless **Angular Aria** patterns for listbox/toolbar/etc. when building chrome around the diagram (toolbars, slot lists).

- https://angular.dev/best-practices/a11y  

### 2.3 Angular CDK drag-and-drop is the wrong abstraction for geometry

Official drag-drop guide covers free dragging of HTML elements, reorderable lists, transfer between lists, handles/previews—**DOM list UX**, not “edit `x/y/width/height` in a pan-zoomable user coordinate system” or corner resize.

- https://angular.dev/guide/drag-drop  

`cdkDrag` can free-drag HTML, but mapping that into SVG user units, resize handles, multi-select, and structural path drawing is still custom work. For an SVG surface editor, **Pointer Events on SVG nodes** is the established, lower-friction path; CDK remains useful for **non-canvas chrome** (reorder slot list sidebar, move items between lists).

---

## 3. Libraries (primary-source capability snapshot)

MDN’s Canvas API page lists several canvas libraries; relevant established ones:

- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API#libraries  

### 3.1 Konva.js (canvas scene graph)

Official overview: Stage → Layers → Groups/Shapes; each layer uses a scene canvas plus a **hit graph** canvas for event detection; built-in drag; JSON serialize/deserialize (`stage.toJSON()` / `Konva.Node.create`); high-quality image exports; framework integrations advertised for React/Vue/Svelte (not first-class Angular).

- https://konvajs.org/  
- https://konvajs.org/docs/overview.html  

**Fit:** excellent if you want library-owned drag/resize/transformer UI on canvas. **Cost:** dependency + dual model (Konva nodes vs Angular/domain model), a11y still external, Angular lifecycle (create/destroy stage on component init/destroy) is manual.

### 3.2 Fabric.js (canvas object model + SVG import/export)

Fabric positions itself as an interactive object model on canvas with serialization, SVG↔canvas parsing, controls for scale/rotation, viewport transforms (zoom/pan), grouping.

- https://fabricjs.com/  

**Fit:** stronger when SVG import of arbitrary artwork and rich object controls matter. **Cost:** same canvas a11y story; large feature surface for a schematic slots editor; Angular integration is community/DIY.

### 3.3 SVG.js (imperative SVG)

Lightweight, no-dependency SVG manipulation and animation API; groups, events, unified move/size APIs; MIT.

- https://svgjs.dev/docs/3.2/  

**Fit:** if you prefer imperative SVG over templates. **Cost:** fights Angular’s “template owns the DOM” model (two writers of the same tree) unless you treat SVG.js as the sole renderer outside Angular templates.

### 3.4 What libraries do *not* buy you for this product

- Domain separation of **linkable slots** vs **never-linked structural drawings** still lives in *your* model and validation.
- Borrower **acceptance snapshot** semantics (immutable fields, cancel/re-accept) are product/API concerns; libraries only help with bytes (JSON/SVG/PNG).
- Angular 22 app currently has no graphics editor stack—adding Konva/Fabric is a permanent complexity tax for a small product.

---

## 4. Persistence-friendly scene graph shapes

### 4.1 Principle: domain model first, renderer second

Established pattern across canvas libraries (e.g. Konva’s `toJSON`) and custom SVG editors: **persist a versioned, framework-agnostic document**, not live DOM or library node instances. Renderers project the document into SVG or canvas.

Suggested **illustrative** shape (research sketch—not an API spec; geometry ticket owns final primitives):

```ts
// Illustrative only — not a committed schema
type SurfaceDocument = {
  version: 1;
  // Optional fixed world size in abstract units (or fit-to-content)
  bounds?: { width: number; height: number };
  // Non-linkable decoration / walls / shelves outline
  structuralDrawings: StructuralDrawing[];
  // Linkable placement regions (Items point at slot id)
  slots: PlacementSlot[];
};

type PlacementSlot = {
  id: string;           // stable id for Item → Slot links
  label: string;        // findability contract
  // Geometry: start simple; expand if domain requires polygons
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
};

type StructuralDrawing =
  | { id: string; kind: 'rect'; x: number; y: number; width: number; height: number; style?: StrokeFill }
  | { id: string; kind: 'path'; d: string; style?: StrokeFill }  // SVG path data if needed later
  | { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number; style?: StrokeFill };
```

**Why this shape maps cleanly:**

| Concern | How the shape helps |
| --- | --- |
| Slot vs structure | Separate arrays / `role` discriminator; linking code only accepts `slots[].id` |
| Layering | Order in arrays or explicit `zIndex`; SVG paint order = document order in two `<g>` layers |
| Migration | `version` field; additive fields for dimensions, notes |
| Renderer swap | Same JSON → SVG template *or* Konva nodes *or* static export |
| Snapshot | Deep-copy document (and/or render) at acceptance; store immutable payload |

### 4.2 Persist geometry numbers, not presentation-only transforms

Store **user-space geometry** in the document. Treat pan/zoom as **view state** (`viewBox` or camera matrix), not as baked transforms on every slot—unless you intentionally support per-shape rotation later. That keeps Item→Slot links stable when owners only pan the camera.

### 4.3 SVG path data as optional structural format

If Structural Drawings need freehand or polylines, SVG path `d` strings are a standard, serializable encoding (SVG 2 path primitives). Slots can remain axis-aligned `rect` for hit-testing and “many items share one slot” simplicity until the geometry ticket says otherwise.

### 4.4 Avoid as system of record

- Raw outerHTML of the live editor SVG (includes handles, selection UI, transient classes).
- Konva/Fabric full stage JSON as the *only* store (couples API to library major versions).
- Canvas pixel buffers as the only store (no slot ids, no labels for linking).

---

## 5. Accessibility

### 5.1 SVG advantages

- Graphics and container elements can carry accessible names via **`<title>`** (and longer **`<desc>`**); MDN notes `<title>` is not rendered as graphics but is used for accessible naming / tooltips; prefer `aria-labelledby` when visible text already exists.

  - https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/title  
  - SVG 2 descriptive elements: https://w3c.github.io/svgwg/svg2-draft/struct.html#DescriptionAndTitleElements  

- SVG 2 documents WAI-ARIA attributes on SVG elements (`role`, `aria-*`, `tabindex`).

  - https://www.w3.org/TR/SVG2/struct.html#WAIARIAAttributes  

- Pattern for slots: focusable region (`tabindex="0"`), `role="button"` or list semantics coordinated with a **parallel HTML list of slots** (often more robust than deep SVG-only keyboard editing), `aria-label` / labelledby = slot label.

### 5.2 Canvas obligations

MDN and HTML Standard: canvas alone is insufficient for AT; provide fallback content with equivalent purpose; for keyboard, focusable fallback regions mapped 1:1 to interactive areas. That duplicates the scene model in HTML—costly for an editor, more acceptable for a **static** borrower view if the fallback is a textual list (“Shelf B · Slot 3”).

### 5.3 Borrower reveal implications

Map notes: post-acceptance reveal = that Item’s Slot + parent Surface (not full atlas); accepted borrowers keep a readable snapshot.

Accessibility-friendly reveal strategies (facts / options):

| Strategy | a11y | Fidelity | Notes |
| --- | --- | --- | --- |
| Interactive SVG of snapshot | Good if titles/labels present | High vector | Same tech as editor, read-only |
| Static SVG image/`img` of export | Needs `alt` / adjacent text | High vector | Snapshot file + text “Slot label · Surface name” |
| Raster PNG/`img` | Needs good `alt` | Resolution-dependent | Simple; canvas `toBlob` path |
| Text-first + optional diagram | Best baseline | Diagram optional | Label string is the contract; diagram is enhancement |

**Editor** can be more pointer-heavy; **borrower reveal** should not depend on canvas hit-testing. Prefer snapshot + explicit text of slot label (and surface identity) regardless of renderer.

Angular: use documented ARIA bindings and, for chrome (slot picker, toolbars), CDK a11y / Angular Aria rather than reinventing listbox patterns.

---

## 6. Export and static snapshot

### 6.1 Vector snapshot from SVG

- **`XMLSerializer.serializeToString(svgElement)`** produces an XML string of a DOM subtree (usable as stored SVG or for download). Not guaranteed well-formed in all edge cases; strip editor chrome before serialize.

  - https://developer.mozilla.org/en-US/docs/Web/API/XMLSerializer  

- Persist **domain JSON** for fidelity of ids/labels; attach or regenerate SVG for display. JSON is easier to validate and migrate than freeform SVG.

### 6.2 Raster snapshot

- Canvas **`toDataURL`** / preferred **`toBlob`** export PNG/JPEG from a bitmap.

  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL  
  - HTML Standard serializing bitmaps: https://html.spec.whatwg.org/multipage/canvas.html  

- SVG → raster path (established browser technique): draw SVG into an `Image` / blob URL, `drawImage` onto a canvas, then `toBlob`. Useful when acceptance must freeze pixels. Tradeoff: loses selectable text/zoom quality vs vector.

### 6.3 Library export

Konva/Fabric emphasize image/JSON export as product features. They accelerate snapshot *bytes*, not domain snapshot *semantics* (which fields freeze at acceptance).

### 6.4 Recommendation for reveal pipeline (research-level)

1. On acceptance: freeze **domain snapshot** (slot id, label, geometry, parent surface id/name, structural drawings needed for context).  
2. Optionally render **SVG string** and/or **PNG** for convenient display/email.  
3. UI always shows **label text** even if the diagram fails to load.

---

## 7. Complexity cost: custom SVG editor vs libraries

Rough effort bands for a **minimal** schematic editor (create/select/move/resize axis-aligned slot rects, draw simple structural rects/lines, pan/zoom, save JSON)—order-of-magnitude, not a schedule commitment:

| Building block | Custom SVG + Angular | + SVG.js | Konva/Fabric |
| --- | --- | --- | --- |
| Render slots/structure from model | Low (templates) | Low–med | Med (map model ↔ nodes) |
| Select + drag move | Low–med (Pointer Events + CTM) | Med | Low (built-in drag) |
| Resize handles | Med (8 handles, clamp min size) | Med | Low–med (controls API) |
| Pan/zoom | Low–med (`viewBox`) | Low–med | Low (viewport APIs) |
| Keyboard nudge / focus | Med (you own it; SVG helps) | Med | Higher (canvas a11y) |
| Persist domain JSON | Low | Low | Low + avoid stage JSON lock-in |
| Angular lifecycle | Natural | Dual ownership risk | Stage create/destroy, NgZone |
| Bundle / upgrade risk | None beyond app | Small lib | Larger lib, breaking majors |
| Future polygons/paths | Add path tools incrementally | Similar | Already broad |

**Sweet spot for a small Angular product:** implement a **thin custom SVG editor** driven by a **domain document**, optionally extract pure functions (hit-test, resize math, `clientToSvg`) into testable TS modules. Adopt Konva/Fabric only if requirements jump to free-transform design-tool territory (rich text on canvas, filters, many image objects)—explicitly *not* the Placement Surface v1 posture.

**Anti-patterns for this repo size:**

- Full whiteboard/CRDT frameworks  
- CAD kernels  
- Map/WMS stacks  
- Using CDK drag-drop as the geometry engine  

---

## 8. Approach shortlist (established, Angular-friendly)

### Approach A — Custom SVG editor (best default fit)

1. Domain `SurfaceDocument` in TS.  
2. Angular component template: `<svg [attr.viewBox]="...">` with `<g data-layer="structure">` and `<g data-layer="slots">`.  
3. Pointer Events for move/resize; `getScreenCTM()` inverse for coordinates.  
4. Sidebar HTML list of slots for a11y and labeling.  
5. Save JSON; snapshot = JSON (+ optional SVG/PNG).  

### Approach B — Canvas library (Konva or Fabric) behind a facade

1. Same domain document.  
2. Adapter maps document ↔ library nodes; editor chrome from library.  
3. Export image via library; still store domain JSON as source of truth.  
4. Build parallel HTML for a11y / borrower text.  

Use when interaction polish cost of Approach A exceeds library cost.

### Approach C — Hybrid

SVG (or HTML overlay) for interactive slots; canvas only for heavy background art. Usually unnecessary for schematic shelves.

### Approach D — Read-only SVG / image for borrower; editor-only complexity isolated

Regardless of A/B, borrower reveal can be a **read-only** projection with simpler a11y—reduces dual-mode complexity in the interactive surface.

---

## 9. Answers mapped to ticket bullets

| Ticket bullet | Finding |
| --- | --- |
| SVG vs canvas vs libraries | **SVG** matches labeled, linkable regions and Angular binding; **canvas** is bitmap + custom scene; **Konva/Fabric** add interaction/export at dependency and a11y cost; **SVG.js** is optional imperative sugar. |
| Persistence scene graph | Versioned **domain JSON** with separate **slots** (stable ids, labels, geometry) vs **structuralDrawings** (visual only); view/camera not baked into geometry; do not use library stage JSON or live editor DOM as system of record. |
| a11y + export for borrower reveal | SVG supports `title`/ARIA/`tabindex`; canvas requires fallback/parallel UI. Snapshot: freeze domain (+ optional SVG string or PNG via canvas). Always expose slot label in text. |
| Complexity vs custom SVG | For schematic rects + light structure, **custom SVG + Angular is lower total complexity** than a canvas framework; CDK drag-drop does not replace geometry editing. |

---

## 10. Sources (primary / high-trust)

| Topic | URL |
| --- | --- |
| SVG intro (MDN) | https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Introduction |
| SVG 2 document structure (W3C) | https://www.w3.org/TR/SVG2/struct.html |
| SVG `viewBox` (MDN) | https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox |
| SVG `<g>` (MDN) | https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/g |
| SVG `<title>` (MDN) | https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/title |
| `getScreenCTM` (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getScreenCTM |
| Canvas API (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API |
| `<canvas>` + a11y (MDN) | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas |
| HTML Standard canvas | https://html.spec.whatwg.org/multipage/canvas.html#the-canvas-element |
| `toDataURL` (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL |
| `XMLSerializer` (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/XMLSerializer |
| Pointer Events `pointerdown` (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event |
| Angular binding (`attr.` / SVG attrs) | https://angular.dev/guide/templates/binding |
| Angular accessibility | https://angular.dev/best-practices/a11y |
| Angular drag and drop | https://angular.dev/guide/drag-drop |
| Konva overview | https://konvajs.org/docs/overview.html |
| Fabric.js | https://fabricjs.com/ |
| SVG.js | https://svgjs.dev/docs/3.2/ |

---

## Out of scope for this research

- Choosing exact geometry primitives (rect vs polygon)—see geometry model ticket.  
- Snapshot field list and acceptance lifecycle—see placement snapshot / borrower reveal tickets.  
- API wire format.  
- Implementation of the editor.
