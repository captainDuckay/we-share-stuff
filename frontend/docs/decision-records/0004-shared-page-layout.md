# Decision Record 0004: Shared page layout

This record captures the decisions from the grilling session about consistent structure and alignment across authenticated application pages.

## Status

Accepted.

## Date

2026-07-21

## Decisions

### 1. What is being standardized?

**Decision:** All authenticated routed pages use one shared Page Layout. This is a constrained page shell, not a general-purpose 12-column grid system.

**Rationale:** Consistent outer boundaries and major regions solve the current alignment problem without giving individual pages enough layout flexibility to recreate it.

### 2. How wide are pages?

**Decision:** Every authenticated page uses the same outer content boundary and gutters as the application header. There are no narrow, standard, or wide page variants.

**Rationale:** A single boundary creates visible alignment across navigation and page content.

### 3. Which regions does Page Layout own?

**Decision:** Page Layout owns the semantic `<main>`, a structured title area, the main content column, and an optional semantic `<aside>`. Page-specific actions and internal section spacing remain the responsibility of projected content.

**Rationale:** The layout should enforce page-level consistency without controlling each feature's internal composition.

### 4. How is the title area structured?

**Decision:** Page Layout renders the page's only `<h1>` from a required title and may render an optional stable description. Contextual state, loading messages, errors, announcements, and actions remain in page content.

**Rationale:** Structured title inputs preserve heading and description consistency. Paragraphs remain appropriate for prose; `<span>` is reserved for inline phrasing rather than used as a general replacement for `<p>`.

### 5. How do dynamic detail titles behave?

**Decision:** Detail pages show a stable generic title while loading and replace it with the loaded entity name. An Item page retains the Item name as its `<h1>` in both view and edit modes; nested view and editor components begin at `<h2>`.

**Rationale:** The page retains a stable identity and valid heading hierarchy across loading and editing states.

### 6. How does back-navigation work?

**Decision:** The title container uses flex layout, with title and description on the left and an optional back link on the right. The link uses the approved Material Symbols Rounded `arrow_back` icon together with visible destination text. It wraps when space is insufficient.

**Rationale:** A structured back link prevents detail pages from placing handwritten arrow links inconsistently and keeps the destination understandable.

### 7. How does the aside behave?

**Decision:** Page Layout renders and accessibly labels the semantic `<aside>`; pages project only its contents. Above `48rem`, the main content is flexible on the left and the aside has the shared `16rem` maximum width on the right. At or below `48rem`, the aside follows the main content in one column. There is no aside-first option.

**Rationale:** One aside width and order preserve consistency. Browse filters therefore use the standard right-hand aside rather than a page-specific left-hand filter column.

### 8. Which pages are migrated?

**Decision:** The initial implementation migrates every authenticated routed page together and removes legacy outer-layout rules. Sign-in and registration retain their focused authentication layout.

**Rationale:** A partial migration would preserve the inconsistency and require old and new page structures to coexist.

## Resulting implementation guidance

The frontend implementation should:

- add one reusable Angular Page Layout component with structured title, optional description, optional back-navigation, default content projection, and optional aside projection;
- align its maximum width and gutters with the application header;
- use flex for the title container and grid for the content/aside regions;
- migrate all authenticated routed page templates to the component;
- move stable introductory copy into the description input while leaving stateful copy in page content;
- move Browse filters and Sharing Group community information into the projected aside region;
- remove page-owned `<main>` and `<h1>` elements, including those currently delegated to nested Item components;
- remove superseded `.sharing-page`, `.my-page`, and browse outer-layout rules without changing feature-internal styling; and
- validate the semantic landmarks, heading hierarchy, projected regions, responsive behavior, tests, and production build.
