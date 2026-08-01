# Research: Angular 22 patterns for global toast and notification center

**Ticket:** [#33 — Research Angular 22 patterns for global toast and notification center](https://github.com/captainDuckay/we-share-stuff/issues/33)  
**Map:** [#28 — Global notification system design](https://github.com/captainDuckay/we-share-stuff/issues/28)  
**Date:** 2026-08-01  
**Scope:** Established Angular 22 (no Material in this repo) patterns and library options for a **global toast region** plus a **Notification Center / sidebar**, driven by a shared client store and a **polled** server inbox. Not a product commitment, API schema, or implementation.

**Product context (orientation only):** Map #28 wants one system, two surfaces—client-only ephemeral toasts + server-persisted Notification inbox; poll/refresh on load, navigation, and window focus (no SSE/WebSocket in this map); deep-link actions from the center; no inline accept/decline in v1. Frontend is Angular 22 with a deliberately small dependency set (`@angular/common|core|forms|platform-browser|router` only; no `@angular/cdk`, no Angular Material).

---

## Question

What established Angular 22 patterns and library options fit a global toast region plus a notification center/sidebar driven by a shared client store and a polled server inbox—trade-offs for signals vs RxJS, overlay/portal approaches, a11y live regions, and anything that would force an architectural choice before API/UI tickets resolve?

Surface facts covered:

1. Pure Angular (no extra deps) approaches for toast host + overlay vs fixed region in app shell  
2. Whether introducing `@angular/cdk` Overlay / portals is justified vs custom  
3. Lightweight third-party toast libs (actively maintained for modern Angular)—licenses and maintenance posture  
4. Signals vs RxJS for a notification/toast store given existing `frontend/src/app/core/` store patterns  
5. Accessibility: `aria-live` for toasts, focus management for a center/sidebar, keyboard  
6. Polling patterns (router events + document visibility) for load / nav / focus freshness  
7. Architectural choices that **must** be decided before implement vs that can wait  

---

## Executive synthesis

| Approach | Fit for toast region | Fit for Notification Center | Dep / complexity cost | Notes |
| --- | --- | --- | --- | --- |
| **Fixed host in app shell** (`position: fixed` + store-driven `@for`) | Strong | Strong (panel in shell or route) | Lowest | Matches current shell ownership (`app.html`); no CDK; full styling control |
| **Native Popover / `<dialog>` for center** | N/A (toasts) | Strong for panel open/close | Lowest | App already uses `popover` for account menu and `dialog[app-dialog]` + `DialogState` inert roots |
| **Custom portal-to-body (DOM move)** | Medium | Medium | Low | Same technique as `AppDialog` moving under `document.body`; useful if shell `overflow`/`inert` clips UI |
| **`@angular/cdk` Overlay + Portal** | Strong if many floating panels | Strong (connected or global position) | Medium (new dep + prebuilt CSS) | Official floating-UI primitive; GlobalPositionStrategy is documented for “application-level notifications”; optional Popover top-layer |
| **CDK `LiveAnnouncer` only** | A11y helper | N/A | Medium if pulled alone | Still needs `@angular/cdk`; pure `aria-live` region usually enough for toasts |
| **Third-party toast only** (`@ngxpert/hot-toast`, …) | Strong for toast chrome | Poor for durable inbox | Medium | Solves ephemeral UI only; does not own server inbox or center; adds version/peer coupling |
| **Angular Material Snack-bar** | Strong | N/A | Out of scope | Repo explicitly has no Material; snack-bar is a *pattern reference*, not a candidate |

**Best-fit pattern for this problem class (research assessment, not commitment):**

1. **One client ownership model:** a root-provided store (or thin pair of stores) holding (a) **ephemeral toast queue** and (b) **inbox projection** (list + unread badge + center open state).  
2. **Toast surface:** fixed **toast host** in the app shell (or body-appended host), rendered from the toast queue with a single **`aria-live`** region; dismiss timers in the store; optional CSS enter/leave via Angular’s `animate.enter` / `animate.leave` (no `@angular/animations` package required).  
3. **Center surface:** non-modal or modal **sidebar/panel** opened from chrome, reading the **same inbox signals**; deep-links via existing `Router`; prefer reusing **native dialog / popover / inert** patterns already in the codebase over introducing CDK for this alone.  
4. **Server freshness:** imperative **`refreshInbox()`** (Promise + signals, matching `SessionStore` / `*Api` + `firstValueFrom`) triggered on **authenticated session ready**, **`NavigationEnd`**, and **`visibilitychange` → visible** (optionally also `window` `focus`). Coalesce in-flight requests.  
5. **Deps:** default to **no new packages**. Add `@angular/cdk` only if multiple floating surfaces need shared positioning/scroll/focus infrastructure beyond what native dialog/popover + fixed CSS already give. Prefer **not** adopting a toast library unless product polish requirements exceed a ~100-line host—and note **ngx-toastr is archived**.

This is a research fit assessment, not a product commitment.

---

## 0. What this codebase already does (local facts)

Relevant established patterns in `frontend/`:

| Pattern | Where | Implication for notifications |
| --- | --- | --- |
| Root signals store + readonly projection | `SessionStore`, `ThemePreferenceStore` | Inbox + toast queue fit the same shape: private `signal` / `asReadonly()` / methods |
| Promise API façade over `HttpClient` | `AuthApi` et al. use `firstValueFrom` | Poll loader should be `Promise`-based; RxJS stays at the HTTP boundary |
| App shell chrome | `app.html` / `App` | Natural home for toast host + center trigger + badge |
| Modal dialogs | `dialog[app-dialog]`, `DialogState`, `appDialogInertRoot` | Center can be a non-modal panel *or* a modal dialog; inert roots already exist if modal |
| Account menu | HTML `popover="auto"` | Lightweight open/close without CDK Overlay |
| No CDK / Material | `frontend/package.json` | Any CDK adoption is a new architectural dep |

`rxjs` is already a dependency (Angular HTTP), but application state is signals-first—not BehaviorSubject stores.

---

## 1. Pure Angular: toast host + center without extra deps

### 1.1 Fixed toast region in the app shell

**Pattern:** a long-lived host outside routed content (e.g. sibling of `router-outlet` in `app.html` or under `body`):

- Store holds `readonly toasts = signal<Toast[]>([])` (or queue + ids).  
- Host `@for (t of toastStore.toasts(); track t.id)` renders cards with `position: fixed` stacking.  
- `show()` pushes an item; `setTimeout` / `AbortController` schedules dismiss; hover can pause.  
- Region attributes: `aria-live="polite"` (default) or `"assertive"` for critical errors; optional `role="status"` / `role="alert"`.  

**Why it fits:**

- Toasts are **not** route-owned; shell host survives navigation (map requires refresh on nav, not remount of chrome).  
- No portal system required if the host is not clipped by `overflow: hidden` ancestors.  
- Full control over design tokens already under `frontend/src/styles/tokens/`.

**Stacking / z-index:** keep toasts above page content but coordinate with open modals (`DialogState.anyOpen`). Common choice: toasts remain visible and non-blocking while dialogs are open (toasts must not sit *under* an inert root that blocks AT access—see §5).

### 1.2 “Overlay” without CDK

Three pure-platform options already aligned with this app:

| Technique | Platform fact | Fit |
| --- | --- | --- |
| **CSS fixed / sticky region** | CSS positioning; independent of Angular | Toast stack, badge, non-modal drawer |
| **HTML Popover API** | Top-layer popovers; app already uses `popover` for account menu | Center as non-modal panel; light dismiss via auto popover |
| **`<dialog>` + `showModal()`** | Modal top layer; focus trap + Escape by UA; app’s `AppDialog` already reparents to `body` and registers inert | Center if product wants modal sheet |

CDK Overlay documents that in supported browsers it **itself** uses the native Popover API for top-layer promotion—evidence that “use Popover / top layer” is the modern platform direction, not only a library trick.

- CDK Overlay package docs (raw): https://raw.githubusercontent.com/angular/components/main/src/cdk/overlay/overlay.md  
- MDN Popover API: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API  

### 1.3 Body reparent (mini-portal)

`AppDialog` already moves the host `dialog` under `document.body` so shell `inert` does not disable the dialog. The same technique can host a toast container or a center panel if clipping/`inert` becomes an issue—without CDK Portals.

- Local: `frontend/src/app/core/dialog/app-dialog.ts`

### 1.4 Notification Center as shell UI (not a feature route requirement)

The center is a **global surface** (map). Implementation options that do not force early routing architecture:

- **Panel in shell** toggled by a signal (`centerOpen`), list from inbox store.  
- **Dedicated route** (e.g. `/notifications`) for deep-linkable full page *in addition* to a compact panel—can wait for UI ticket.  
- **Both:** panel for quick scan; route for history (optional later).

Deep-link **actions** (map: navigate into existing flows) are normal `routerLink` / `Router.navigate` from list items—no special overlay API required.

### 1.5 Enter / leave motion without Material / without legacy animations

Angular’s current animation guide documents **`animate.enter` / `animate.leave`** as compiler-supported CSS class hooks (or function callbacks), explicitly separate from legacy `@angular/animations`. Suitable for toast mount/unmount and panel open if motion is desired; respect `prefers-reduced-motion` in CSS.

- https://angular.dev/guide/animations  

---

## 2. `@angular/cdk` Overlay / portals — justified or not?

### 2.1 What Overlay / Portal officially are

From Angular CDK primary docs:

- **Overlay:** “a way to open floating panels on the screen.” `overlay.create()` → `OverlayRef` (a `PortalOutlet`); attach content via portals.  
- **Position:** `GlobalPositionStrategy` for viewport-fixed placement—docs call out use for **modal dialogs and application-level notifications**; `FlexibleConnectedPositionStrategy` for menus/tooltips relative to an origin.  
- **Scroll strategies:** noop / close / block / reposition.  
- **Container:** default append to body; optional native Popover top-layer; `FullscreenOverlayContainer` for fullscreen apps.  
- **Portal:** low-level “piece of UI” (`Component` / `TemplateRef` / DOM) dynamically attached to a `PortalOutlet`. Overlay is built on portals.

Sources:

- Overlay: https://raw.githubusercontent.com/angular/components/main/src/cdk/overlay/overlay.md  
- Portal: https://raw.githubusercontent.com/angular/components/main/src/cdk/portal/portal.md  
- Categories: https://material.angular.dev/cdk/categories  

Package: `@angular/cdk` peer-matches Angular 22 (`^22` / `^23` peers as of this research); **MIT**. Full package unpacked size on npm is large; apps typically tree-shake to used entry points (`@angular/cdk/overlay`, `@angular/cdk/a11y`, …). Still requires importing **overlay prebuilt CSS** if not using Material theme styles.

### 2.2 CDK a11y helpers relevant to this map

Angular’s a11y guide points at CDK:

- **`LiveAnnouncer`:** announces strings via an `aria-live` region (`polite` / `assertive`).  
- **`cdkTrapFocus`:** tab trap for modal dialogs.

Primary:

- https://angular.dev/best-practices/a11y  
- LiveAnnouncer: https://raw.githubusercontent.com/angular/components/main/src/cdk/a11y/live-announcer/live-announcer.md  

For **toasts**, a dedicated host with `aria-live` is equivalent in capability to `LiveAnnouncer` for this use case (announce text that already appears visually). `LiveAnnouncer` is more useful when you need off-screen announcements without a visible toast.

For **center**, if implemented as **modal**, prefer either native `<dialog showModal()>` (browser focus trap) or CDK focus trap—not both inventively.

### 2.3 Trade-off for *this* repo

| If you need… | Prefer |
| --- | --- |
| Toast stack + inbox panel + badge only | **No CDK** — fixed host + signals + native dialog/popover |
| Many connected floating UIs (menus, pickers, tooltips) sharing one positioning system | **CDK Overlay** becomes justified as shared infrastructure |
| Only `LiveAnnouncer` | Still pulls CDK; custom live region is simpler |
| Match Material snack-bar positioning quirks | CDK + custom panel, or Material (out of scope) |

**Research recommendation:** do **not** introduce `@angular/cdk` solely for toast + center. Revisit if a broader “floating UI kit” ticket appears. The app’s existing dialog reparent + popover patterns already solve top-layer / inert concerns for a notification center.

---

## 3. Third-party toast libraries (primary docs / npm / repo status)

Scope: ephemeral toast UI only. **None** of these implement a polled server inbox or Notification Center domain model.

### 3.1 Comparison snapshot (as of 2026-08-01)

| Library | License | Angular peer posture | Maintenance signal | Notes |
| --- | --- | --- | --- | --- |
| **[@ngxpert/hot-toast](https://github.com/ngxpert/hot-toast)** | MIT | Official table through **≥21** (v6.x); npm `6.4.1` peers `@angular/* >= 21` | Active (`pushed_at` 2026-07) | Peer **`@ngneat/overview`**; documents `aria-live`, `role`, reduced motion, optional Popover API, custom container token |
| **[ngx-toastr](https://github.com/scttcper/ngx-toastr)** | MIT | README matrix includes modern Angular; npm `20.0.5` peers `@angular/* ^21` | **GitHub repo archived** (2026) | Still on npm; **do not base long-lived architecture on archived project** |
| **[ngx-sonner](https://github.com/tutkli/ngx-sonner)** | MIT | peers `@angular/* >= 19` | Quiet (last push ~2025-03) | Sonner port; root toaster pattern; less evidence of Angular 22 cadence |
| **Angular Material snack-bar** | MIT | Matches Angular version | First-party | Out of scope (no Material); useful as *behavioral* reference only |

Sources: library READMEs / npm `peerDependencies` / GitHub `archived` + `pushed_at` via API; hot-toast README https://raw.githubusercontent.com/ngxpert/hot-toast/main/README.md ; ngx-toastr README https://raw.githubusercontent.com/scttcper/ngx-toastr/master/README.md .

### 3.2 hot-toast — facts that matter for this map

From the official README:

- Install path: `provideHotToastConfig()` + base styles; optional themes.  
- Accessibility section: messages announced via **`aria-live`** (default **`polite`**); **do not move focus** to the toast; actions in toasts need alternate paths; actionable toasts should set `autoClose: false`.  
- Options for `role` / `ariaLive` per toast.  
- Optional HTTP error interceptor (would **collide** with this app’s intentional session-expiry interceptor policy—treat as non-default).  
- Extra peer: `@ngneat/overview` (unpacked ~75 KB on npm; hot-toast unpacked ~400 KB—**not** equivalent to final bundle, but signals cost).

**Fit:** polished ephemeral toasts if the team wants library-owned stacking/themes. **Does not** replace Notification Center, polling, or domain store. Couples release cadence to Angular major bumps + overview peer.

### 3.3 ngx-toastr — caution

README still documents `provideToastr()`, optional container with **`aria-live="polite"`**, and MIT license. GitHub marks the repository **archived**. For a greenfield subsystem, archived upstream is a strong reason to prefer either pure Angular or actively maintained hot-toast.

### 3.4 Library recommendation (research)

| Preference | Choice |
| --- | --- |
| Match small dep surface + full design-token control | **Custom toast host** |
| Want battle-tested toast UX quickly | **`@ngxpert/hot-toast`** (verify Angular 22 peer range at implement time; pin majors) |
| ngx-toastr | **Avoid** for new work (archived) |
| Material snack-bar | **Out of scope** |

**Architectural note:** even with a library, keep **`ToastStore` / service façade** owned by the app so domain code does not import library types deeply—swap cost stays low.

---

## 4. Signals vs RxJS for toast + inbox store

### 4.1 Platform facts

- **Signals** are the Angular-documented model for synchronous, granular UI state (`signal`, `computed`, `effect`, `asReadonly`). Services expose readonly signals and mutation methods—exactly what `SessionStore` / `ThemePreferenceStore` / `DialogState` already do.  
  - https://angular.dev/guide/signals  
- **HttpClient** returns cold RxJS `Observable`s; each subscribe = one request.  
  - https://angular.dev/guide/http/making-requests  
- **Interop:** `toSignal` / `toObservable` / `rxResource` bridge the two worlds.  
  - https://angular.dev/ecosystem/rxjs-interop  
- **`resource` / `httpResource`:** first-class async data in signal code; `params` recompute → loader runs; `reload()` for manual refresh; abort via `AbortSignal`. Fits “refetch inbox when X changes” if `params` encode a refresh token / route id / session user id.  
  - https://angular.dev/guide/signals/resource  

### 4.2 What this app already chose

API services convert HTTP Observables to **Promises** (`firstValueFrom`) and stores hold **signals**. There is no global event-bus `Subject` pattern for session.

### 4.3 Recommended state split

| Concern | Suggested primitive | Why |
| --- | --- | --- |
| Toast queue (client-only) | `signal` + methods `show` / `dismiss` / `clear` | Ephemeral, fully client-owned; timers with cleanup on destroy |
| Center open / filter UI | `signal` | Local chrome state |
| Inbox list + unread count | `signal` (or `resource` value) updated by refresh | Polled snapshot, not a push stream in this map |
| In-flight / error | `signal` status flags or `resource.status` | Match `SessionStatus` style |
| Trigger composition (nav + visibility) | Prefer **imperative** `refresh()` from listeners; optional RxJS `merge` + `switchMap` if preferred | Either works; don’t force RxJS store just for event merge |
| HTTP | Keep `firstValueFrom` or use `httpResource` | Stay consistent with interceptors (`withCredentials`, CSRF, session expiry) |

**Signals vs RxJS verdict for this map:**

- **UI + domain projection → signals** (non-negotiable if we stay consistent with core stores).  
- **RxJS → transport and optional event plumbing only**, not the system of record for inbox/toasts.  
- Using a full RxJS `BehaviorSubject` inbox store would **diverge** from established core patterns without buying correctness for poll-based data.

**Toast vs inbox coupling:** map says ephemeral toasts do **not** become server Notifications unless a domain event also creates one. Architecturally that means:

- `toast.show(...)` is never the write path for the inbox.  
- After a successful domain mutation, callers may **both** `toast.show('…')` and `inbox.refresh()` (or rely on next poll).  
- Optional later: when refresh detects *new* inbox items, decide whether to also toast—that is product policy, not a store-primitive issue.

---

## 5. Accessibility

### 5.1 Live regions for toasts (primary)

WAI-ARIA defines **live regions** as areas that update while focus may be elsewhere. The **`aria-live`** property sets politeness:

- **`polite`:** notify without interrupting the current task (default for most toasts / status).  
- **`assertive`:** interrupt; may clear the speech queue—reserve for critical failures.  
- Roles such as **`status`** (implicit polite live region) and **`alert`** (implicit assertive) encode defaults.

Primary:

- WAI-ARIA 1.2 `aria-live`: https://www.w3.org/TR/wai-aria-1.2/#aria-live  
- Live region concept in the same spec (glossary / live region attributes).  
- Angular a11y guide (ARIA binding + LiveAnnouncer pointer): https://angular.dev/best-practices/a11y  

**Practical toast rules (aligned with hot-toast’s documented a11y section and ARIA):**

1. Keep a stable live region container (or per-toast live attributes carefully—stable container is usually more reliable).  
2. Prefer **`aria-live="polite"`** / `role="status"` for success/info; **`assertive`** / `alert` only for blocking errors.  
3. **Do not steal focus** for ordinary toasts (disrupts forms and AT virtual cursor).  
4. If a toast exposes an action, provide the same action elsewhere (map v1 deep-links live in the **center**, which helps).  
5. Visible text should match announced text; avoid HTML-only styling that omits text alternatives.  
6. Honor **`prefers-reduced-motion`** for slide/fade.

### 5.2 Notification Center / sidebar

Center is **interactive history**, not a live region for the whole list (announcing every poll would be hostile). Patterns:

| Behavior | Practice |
| --- | --- |
| Open control | Native `<button>` with accessible name (“Notifications”); `aria-expanded` when applicable; optional badge with text alternative (“3 unread”) |
| Panel as non-modal | Popover or complementary region (`role="dialog"` only if modal semantics intended); Esc + light dismiss |
| Panel as modal | Prefer existing `<dialog showModal()>` + `DialogState` inert roots; focus moves into dialog; restore focus to trigger on close |
| List | Semantic list; each item is a link/button to deep-link target; unread state via text or `aria-current` / clear labeling—not color alone |
| Keyboard | Tab order through items; Esc closes; no need for listbox semantics unless multi-select appears later |
| Poll updates while open | Update DOM quietly; optional polite status “Notifications updated” only if product wants it—default off |

**Angular Aria** (`@angular/aria`) provides headless menu/listbox/etc. patterns but **no toast or dialog package** in the documented set (accordion, combobox, listbox, menu, tabs, toolbar, tree, …). Not required for a simple notification list of links.

- https://angular.dev/guide/aria/overview  

### 5.3 Focus management after navigation

Angular’s a11y guide documents moving focus after `NavigationEnd` so keyboard/AT users land in new main content—relevant when a notification deep-link navigates:

- https://angular.dev/best-practices/a11y#focus-management-after-navigation  

The notification system should not fight that: close the center on navigate (or leave open—product choice), and let app-level focus strategy own the destination page.

### 5.4 Interaction with existing `inert` dialog system

If the center is **non-modal**, keep it **outside** inert roots or ensure it is not marked inert when dialogs open (same class of bug as toasts under an inert shell). If the center is **modal**, register with `DialogState` like other dialogs. Toast host should remain **announcable** even when a modal is open (screen readers still need polite errors)—place the live region **outside** inert roots (body-level host).

---

## 6. Polling / freshness patterns (load, navigation, focus)

Map constraint: **no SSE/WebSocket**; refresh on **app load**, **navigation**, and **window focus**.

### 6.1 Triggers (platform)

| Trigger | Mechanism | Notes |
| --- | --- | --- |
| App load / session ready | Existing `provideAppInitializer` + `SessionStore.restore()`; start inbox only when `status === 'authenticated'` | Avoid anonymous polling |
| Navigation | `Router.events` filtered to `NavigationEnd` (same event Angular documents for a11y focus) | Coalesce with in-flight refresh |
| Window / tab focus | `document.visibilitychange` when `visibilityState === 'visible'`; optionally `window` `focus` | `visibilitychange` is the standard signal that the page became visible again; MDN: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event |
| Manual | User opens center → `refresh()` | Ensures open panel is current |
| Interval timer | **Not required by map**; optional backoff later | Prefer event-driven refresh first |

### 6.2 Implementation shapes (all valid)

**A. Imperative store (best match to `SessionStore`):**

```ts
// Illustrative sketch only — not an implementation
@Injectable({ providedIn: 'root' })
export class NotificationInboxStore {
  readonly #items = signal<Notification[]>([]);
  readonly items = this.#items.asReadonly();
  #inFlight: Promise<void> | null = null;

  refresh = (): Promise<void> => {
    if (this.#inFlight) return this.#inFlight;
    this.#inFlight = this.#api
      .list()
      .then((page) => this.#items.set(page.items))
      .finally(() => {
        this.#inFlight = null;
      });
    return this.#inFlight;
  };
}
```

Wire listeners once from an initializer or shell component:

- `effect` / constructor: when session becomes authenticated → `refresh()`  
- `router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())` → `refresh()`  
- `fromEvent(document, 'visibilitychange')` → if visible → `refresh()`  

**B. Signal `resource` with a refresh key:**

```ts
// Illustrative: bump refreshToken on nav/focus; resource reloads
readonly #refreshToken = signal(0);
readonly inbox = resource({
  params: () => ({
    userId: this.session.user()?.id,
    token: this.#refreshToken(),
  }),
  loader: ({ params, abortSignal }) =>
    params.userId
      ? this.#api.list({ signal: abortSignal })
      : Promise.resolve({ items: [] }),
});
// on NavigationEnd / visibility: this.#refreshToken.update(n => n + 1)
```

`resource.reload()` is the documented manual path when params are unchanged.

**C. RxJS merge of triggers + `switchMap` to HTTP:** valid; convert terminal state into signals with `toSignal` if desired. Higher ceremony than A for this map’s simple poll policy.

### 6.3 Coalescing and cost

- **Single-flight** (`#inFlight` promise) prevents nav storms.  
- **Auth gate** stops 401 spam for anonymous visitors.  
- **Error policy:** keep last good inbox; surface a non-blocking status (toast optional).  
- **Badge:** `computed(() => items().filter(n => !n.read).length)` once API shape exists.  
- Multi-tab consistency is explicitly “not yet specified” on the map—server is source of truth; each tab polls independently.

---

## 7. Architectural choices: decide now vs wait

### 7.1 Should decide before (or at start of) implement — forces structure

| Decision | Why it gates work |
| --- | --- |
| **Two surfaces, one ownership model** | Confirm store boundaries: `ToastStore` (client-only) vs `NotificationInboxStore` (server projection) vs single façade service with two signal trees |
| **No push transport in v1** | Locks client to poll/refresh API; don’t design SSE clients “just in case” |
| **Toast host placement** | Shell fixed region vs body portal; must sit outside `inert` when modals open |
| **Center modality** | Modal (`dialog` + inert) vs non-modal (popover/drawer) drives focus, Esc, and z-index vs toasts |
| **Signals-first stores** | Stay consistent with `core/`; avoid RxJS-only global bus |
| **Dep policy** | Default **no** toast lib / **no** CDK unless a later ticket expands floating UI needs |
| **Auth-gated polling** | Only when `SessionStore` is authenticated |
| **Deep-link only actions in center (v1)** | List items are navigation targets; no accept/decline widgets in the panel |

### 7.2 Can wait for API / UI / domain tickets

| Decision | Why it can wait |
| --- | --- |
| Exact Notification DTO / kind enum | Store can hold `unknown` projection until schemas land |
| Unread/read PATCH semantics | Badge math and “mark read on open vs on click” |
| Whether new inbox items ever auto-toast | Product policy after kind catalog |
| Center visual design (sheet vs full page vs both) | Shell panel is enough to unblock store + poll |
| Retention / archive | Server policy |
| Multi-tab optimization (BroadcastChannel) | Not in map |
| Toast stacking position / density | CSS tokens later |
| Reduced-motion copy variants | Polish |
| Introducing CDK for other chrome | Separate justification |
| Home curated attention subset | Same inbox model; Home ticket later |

### 7.3 Explicit non-decisions (out of this research)

- Backend emission (sync vs outbox) — map “Not yet specified”  
- Email/push — out of map scope  
- Exact badge placement chrome  

---

## 8. Suggested reference architecture (illustrative)

```
┌─────────────────────────────────────────────────────────┐
│ App shell (app.html)                                    │
│  [nav] [badge btn] [account popover]                    │
│  <router-outlet />                                      │
│  <app-toast-host aria-live="polite" />  ← outside inert │
│  <app-notification-center />  ← dialog or popover       │
└─────────────────────────────────────────────────────────┘
           │ reads/writes              │ reads
           ▼                           ▼
   ToastStore (signals)      NotificationInboxStore (signals)
           │                           │
           │ client-only               │ NotificationApi.list()
           │                           │ refresh: load / NavigationEnd /
           │                           │         visibilitychange
           ▼                           ▼
        (none)                    FastAPI inbox (future)
```

Call sites:

- Feature code → `toastStore.show({ kind: 'success', message })` after local mutations.  
- Domain events that create server Notifications → appear on next `refresh` (and optionally a separate toast from the mutating feature).  
- Center item click → `Router.navigate` to existing routes; optional `markRead` then refresh.

---

## 9. Sources (primary)

### Angular

- Signals: https://angular.dev/guide/signals  
- Resource: https://angular.dev/guide/signals/resource  
- RxJS interop: https://angular.dev/ecosystem/rxjs-interop  
- HTTP: https://angular.dev/guide/http/making-requests  
- Accessibility: https://angular.dev/best-practices/a11y  
- Enter/leave animations: https://angular.dev/guide/animations  
- Angular Aria overview: https://angular.dev/guide/aria/overview  

### Angular CDK (official package docs)

- Overlay: https://raw.githubusercontent.com/angular/components/main/src/cdk/overlay/overlay.md  
- Portal: https://raw.githubusercontent.com/angular/components/main/src/cdk/portal/portal.md  
- LiveAnnouncer: https://raw.githubusercontent.com/angular/components/main/src/cdk/a11y/live-announcer/live-announcer.md  
- CDK categories: https://material.angular.dev/cdk/categories  

### A11y / platform

- WAI-ARIA 1.2 `aria-live`: https://www.w3.org/TR/wai-aria-1.2/#aria-live  
- Document `visibilitychange`: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event  
- Popover API: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API  

### Libraries (official READMEs / registry)

- @ngxpert/hot-toast: https://github.com/ngxpert/hot-toast / https://raw.githubusercontent.com/ngxpert/hot-toast/main/README.md  
- ngx-toastr: https://github.com/scttcper/ngx-toastr (archived) / README  
- ngx-sonner: https://github.com/tutkli/ngx-sonner  
- npm metadata for peers/licenses (`@angular/cdk`, `@ngxpert/hot-toast`, `ngx-toastr`, `ngx-sonner`) as of research date  

### Local codebase

- `frontend/package.json`  
- `frontend/src/app/core/session/session.store.ts`  
- `frontend/src/app/core/theme/theme-preference.store.ts`  
- `frontend/src/app/core/dialog/*`  
- `frontend/src/app/app.html` / `app.ts` / `app.config.ts`  
- `frontend/src/app/core/api/*` (`firstValueFrom` pattern)  

---

## 10. Bottom line

For We Share Stuff’s Angular 22 stack, a **custom shell toast host + signals stores + poll-on load/nav/visibility inbox**, reusing **native dialog/popover and existing inert patterns** for the center, is the lowest-risk fit. **`@angular/cdk` Overlay is capable but not justified for this map alone.** Toast libraries are optional polish; **hot-toast** is the only actively maintained candidate with clear a11y docs—**ngx-toastr is archived**. Keep **RxJS at the HTTP edge**; put **inbox and toasts in signals** like the rest of `core/`. Decide modality of the center, host placement vs `inert`, and the two-store ownership split before coding; leave DTO shape, auto-toast policy, and visual density to later tickets.
