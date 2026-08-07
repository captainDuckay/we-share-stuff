# Research: Tailscale Serve HTTPS to Compose on MagicDNS

**Ticket:** [#75 — Tailscale Serve HTTPS to Compose on MagicDNS](https://github.com/captainDuckay/we-share-stuff/issues/75)  
**Map:** [#73 — Secure production Compose plan (friend VM + Tailscale)](https://github.com/captainDuckay/we-share-stuff/issues/73)  
**Date:** 2026-08-07  
**Scope:** How Tailscale Serve should terminate HTTPS on a MagicDNS name (`*.ts.net`) and reverse-proxy to a single Compose HTTP upstream (internal path router) for this cookie-based SPA + FastAPI app. Not an implementation of Serve config in-repo; not a live cutover.

**Standing preferences (map, orientation):**

- Tailscale-only access (not public Funnel / public internet)
- Serve terminates HTTPS; Compose stays HTTP behind it
- One internal router port for `/` and `/api`
- Must support Secure cookies (`COOKIE_SECURE=true` in production)

**Primary sources (Tailscale docs):**

- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
- [`tailscale serve` CLI](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Serve examples](https://tailscale.com/docs/reference/examples/serve)
- [Enabling HTTPS certificates](https://tailscale.com/docs/how-to/set-up-https-certificates)
- [MagicDNS](https://tailscale.com/docs/features/magicdns)
- [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) (contrast only; out of scope for this map)

**App sources (cookie / origin contract):**

- `backend/app/config.py` — production requires `cookie_secure`; rejects `*` origins
- `backend/app/cookies.py` — host-only cookies; session `HttpOnly` + `SameSite=Lax` + path `/api`; CSRF readable + path `/`
- `backend/README.md` — session security summary
- `backend/app/csrf.py` — unsafe requests must present an Origin in `FRONTEND_ORIGINS`

---

## Question

How should **Tailscale Serve** terminate HTTPS on a MagicDNS name and forward to a **single Compose HTTP upstream** (internal router), for a cookie-based SPA + FastAPI app?

Cover:

1. Recommended Serve config shape
2. Certificate model
3. Whether the browser origin is `https://<name>.ts.net` (and port implications)
4. Implications for `FRONTEND_ORIGINS` + `COOKIE_SECURE=true` production rules

---

## Executive recommendation

| Topic | Recommendation |
| --- | --- |
| **Access mode** | Use **Serve only** (tailnet-private). Do **not** enable Funnel for this app port. Funnel is public internet exposure and is out of scope for map #73. |
| **TLS edge** | Tailscale Serve on the host terminates HTTPS with an auto-provisioned Let's Encrypt cert for the node FQDN. |
| **Upstream** | One reverse proxy from Serve root `/` → `http://127.0.0.1:<router-port>` (Compose internal Caddy/nginx that splits `/` vs `/api`). |
| **Browser origin** | Prefer **`https://<machine>.<tailnet>.ts.net`** on **port 443** (default Serve HTTPS). Origin has **no port suffix**. |
| **App env** | Production: `ENVIRONMENT=production`, `COOKIE_SECURE=true`, `FRONTEND_ORIGINS=https://<machine>.<tailnet>.ts.net` (exact origin string; no wildcard; no trailing slash). |
| **Binding** | Publish the Compose router only on **localhost** (or a Docker bridge not reachable from the LAN/tailnet without Serve). Avoid binding the router on `0.0.0.0` if clients could bypass Serve. |

**Operational one-liner (shape, not a checked-in config):**

```bash
# Prerequisites: MagicDNS on; HTTPS Certificates enabled for the tailnet;
# Compose internal router listening on 127.0.0.1:<router-port>.

tailscale serve --bg --https=443 http://127.0.0.1:<router-port>
# Equivalent shorthand when HTTPS/443 is the default:
# tailscale serve --bg <router-port>
```

Status then reports a tailnet-only URL like:

```text
Available within your tailnet:
https://<machine>.<tailnet>.ts.net

|-- / proxy http://127.0.0.1:<router-port>
```

Use `--bg` so Serve survives shell exit; after reboot/`tailscale up`, background Serve resumes (per Serve CLI docs). Turn off with `tailscale serve --https=443 off` or `tailscale serve reset` when intentional.

---

## 1. Serve vs Funnel (must not confuse)

| | **Serve** | **Funnel** |
| --- | --- | --- |
| Who can reach it | Devices in the **tailnet** (plus accepted shares of that node) | **Public internet** via Funnel relays |
| Purpose for this map | **In scope** — private production access | **Out of scope** — public exposure |
| Identity headers to backend | Yes (`Tailscale-User-*`) | No |
| Same port Serve + Funnel | **Cannot** share a port: last command wins (private vs completely public) | Same |
| HTTPS requirement | MagicDNS + HTTPS Certificates in admin DNS settings | Same prerequisites, plus funnel node attribute |

Docs: Serve is “share within your tailnet”; Funnel is “route traffic from the broader internet.” Map preference is Tailscale-only → **Serve**.

---

## 2. Recommended Serve config shape

### 2.1 Topology

```text
[ Browser on a tailnet device ]
        |
        |  HTTPS (TLS terminated by tailscaled / Serve)
        |  Host: <machine>.<tailnet>.ts.net
        v
[ Host: Tailscale Serve --https=443 ]
        |
        |  plain HTTP reverse proxy (loopback only)
        v
[ Compose: single internal router :PORT ]  e.g. Caddy/nginx
        |-- /     → static SPA
        '-- /api  → FastAPI
```

This matches map preferences: **one** Serve target port; path split stays **inside** Compose.

### 2.2 CLI shape (primary)

From the Serve feature page and CLI reference:

- Default mode for `tailscale serve <target>` is an **HTTPS reverse proxy**.
- Target may be a port (`3000`), `localhost:3000`, or full URL; **proxies support only `http://127.0.0.1`** (loopback HTTP upstream).
- `--https=<port>` listens for HTTPS (default); `--http=<port>` would serve cleartext on the tailnet (not what we want for Secure cookies).
- `--set-path` mounts a path prefix; for a same-origin SPA+API we want the **root** mount `/` only (no path prefix strip/remap at Serve).
- `--bg` for durable background config.

**Recommended:**

```bash
tailscale serve --bg --https=443 http://127.0.0.1:<router-port>
```

Do **not** mount `/api` and `/` as two separate Serve paths pointing at two Compose services. Path routing belongs to the internal router so cookies, SPA assets, and API share one origin.

### 2.3 What not to do for this app

| Pattern | Why not |
| --- | --- |
| `tailscale funnel …` on the same port | Public internet; out of map scope; last-writer also flips privacy of the port |
| Serve `--http=80` as the browser-facing edge | No TLS at the browser → Secure cookies will not be stored/sent by browsers |
| Serve two HTTPS mounts (`/` → SPA container, `/api` → API container) | Breaks “one router” preference; duplicates path policy outside Compose |
| Proxy to a non-loopback Compose publish (`http://100.x.y.z:…` or LAN IP) | Bypasses “localhost-only backend” best practice from Serve docs (identity header spoofing / direct access) |
| Terminate TLS inside Compose with separate public certs | Conflicts with “Serve terminates HTTPS; Compose HTTP behind it” |

### 2.4 Optional: Tailscale Services

Newer Tailscale Services (`--service=svc:…`, VIP + stable MagicDNS independent of a single host) can also front HTTPS with Serve. That is optional HA/stable-name machinery, **not required** for a single friend VM. Default for this map: **node Serve on the VM’s machine name**.

### 2.5 Persistence and ops notes

- Background Serve (`--bg`) resumes after reboot / `tailscale down`+`up`.
- Foreground Serve dies with the terminal.
- Inspect: `tailscale serve status` (and `--json`).
- Clear: `tailscale serve reset` or `… off` for a specific listener.
- ACLs apply to Serve like any other service — who may open `https://…ts.net` is still governed by tailnet policy (friend ACL details remain map “not yet specified”).

---

## 3. Certificate model

### 3.1 Prerequisites (tailnet admin)

From [Enabling HTTPS](https://tailscale.com/docs/how-to/set-up-https-certificates) and Serve troubleshooting:

1. **MagicDNS** enabled (DNS admin page). Default on for tailnets created on/after 2022-10-20.
2. **HTTPS Certificates** enabled under the same DNS page.
3. Acknowledge that **machine names + tailnet DNS name appear in public Certificate Transparency ledgers**.

Serve requires HTTPS certificates; interactive `tailscale serve` can prompt/consent to enable HTTPS if missing.

### 3.2 What Serve does with certs

- HTTPS traffic uses an **automatically provisioned TLS certificate**.
- By default, **the device’s Tailscale daemon terminates the HTTPS connection** (Serve is the TLS edge).
- Certificates are for the node’s **FQDN**:  
  `https://<machine-name>.<tailnet-dns-name>`  
  e.g. `monitoring.yak-bebop.ts.net` in Tailscale’s docs.
- Under the hood (manual `tailscale cert` path): Let's Encrypt via **DNS-01** challenges; Tailscale creates `*.ts.net` DNS TXT records; **private keys stay on the machine** (Tailscale never sees them).
- When TLS is handled by the daemon integration (Serve / similar), renewal is automatic without the operator managing PEM files. File-based `tailscale cert` installs require **operator-driven renewal** — prefer Serve’s integrated path so we do not own PEMs.

### 3.3 Public ledger implications (security posture)

- CT logs publish the **hostname**, not the ability to reach the service.
- Reachability remains Tailscale-authenticated (Serve is not public).
- **Do not put sensitive secrets in the machine name** before enabling HTTPS / Serve.
- Prefer a stable, non-sensitive machine name (e.g. `we-share-stuff` or `wss-prod`) so the origin and CT entry stay boring and sticky.

### 3.4 What Compose does **not** need

- No public Let's Encrypt client in Compose.
- No TLS cert volume mounts for the edge.
- Internal router may speak plain HTTP on loopback only.

---

## 4. Browser origin and ports

### 4.1 Canonical origin (recommended)

With default Serve HTTPS on **443**:

| Piece | Value |
| --- | --- |
| Scheme | `https` |
| Host | `<machine>.<tailnet>.ts.net` |
| Port | **443** (default; **omitted** from the origin serialization) |
| **Origin string** | `https://<machine>.<tailnet>.ts.net` |

Browsers treat origin as scheme + host + port. Default HTTPS port is not included in the Origin header value.

Serve examples show URLs without a port:

```text
https://amelie-workstation.pango-lin.ts.net
```

That is the production browser origin for SPA and API when everything is same-origin behind one Serve front door.

### 4.2 Non-default HTTPS ports

`--https=8443` (or any non-443 port) yields:

```text
https://<machine>.<tailnet>.ts.net:8443
```

Then **`FRONTEND_ORIGINS` must include the port**. Prefer **443** so:

- Origin is stable and short
- No accidental mismatch between bookmarked URL and config
- Matches common Secure-cookie + HSTS expectations

Funnel is limited to ports 443 / 8443 / 10000; Serve is more flexible, but for this app **443 is the right default**.

### 4.3 Short MagicDNS names

MagicDNS also resolves short names like `http://my-node` for **HTTP** Serve. For **HTTPS certificates**, Tailscale documents that you get the FQDN form (`https://machine-name.tailNNNN.ts.net`), not a bare `https://machine-name` cert URL. Operators and `FRONTEND_ORIGINS` should use the **full `*.ts.net` FQDN**, not the short name.

### 4.4 Same-origin SPA + API

Because Serve proxies **all paths** on that host to one router:

- SPA: `https://…ts.net/`
- API: `https://…ts.net/api/…`

Browser sees **one origin**. That fits:

- Host-only session cookie path `/api`
- CSRF cookie path `/`
- `SameSite=Lax` (same-site navigations and same-origin XHR/fetch)
- Angular (or other) client calling relative `/api` without cross-origin credential pitfalls

---

## 5. Implications for this app (`FRONTEND_ORIGINS` + `COOKIE_SECURE`)

### 5.1 Production settings contract

From `backend/app/config.py`:

- `environment == "production"` **requires** `cookie_secure` true (startup validation failure otherwise).
- `frontend_origins` must be a non-empty comma-separated list.
- Wildcards (`*`) are rejected.
- Origins are exact string matches after strip (used by CORS middleware and CSRF Origin checks).

From `backend/app/cookies.py` / README:

- Session cookie: `HttpOnly`, `SameSite=Lax`, path `/api`, `Secure` when `COOKIE_SECURE=true`.
- CSRF cookie: readable, `SameSite=Lax`, path `/`, same Secure flag.
- Unsafe methods need `Origin ∈ FRONTEND_ORIGINS` and matching `X-XSRF-TOKEN`.

### 5.2 Recommended production env (conceptual)

```bash
ENVIRONMENT=production
COOKIE_SECURE=true
FRONTEND_ORIGINS=https://<machine>.<tailnet>.ts.net
```

If multiple stable names are ever needed (rename migration), comma-separate **exact** origins — still no wildcards:

```bash
FRONTEND_ORIGINS=https://wss-prod.yak-bebop.ts.net,https://old-name.yak-bebop.ts.net
```

### 5.3 Why Serve HTTPS unlocks Secure cookies

| Browser URL | `COOKIE_SECURE=true` | Result |
| --- | --- | --- |
| `https://…ts.net` via Serve | true | Cookies set and sent — **desired production** |
| `http://…` or `http://127.0.0.1:…` | true | Browsers **will not** store/send Secure cookies |
| Local dev `http://localhost:4200` | false | Current compose/dev defaults — keep separate from production |

Production must not fall back to cleartext browser access for the same host if operators expect sessions to work.

### 5.4 Origin header exactness

CSRF checks (`backend/app/csrf.py`) reject Origins not in the configured list. Mismatches to avoid:

| Browser actually uses | Configured `FRONTEND_ORIGINS` | Outcome |
| --- | --- | --- |
| `https://foo.bar.ts.net` | `https://foo.bar.ts.net` | OK |
| `https://foo.bar.ts.net` | `http://foo.bar.ts.net` | **403** origin_not_allowed |
| `https://foo.bar.ts.net:8443` | `https://foo.bar.ts.net` | **403** |
| `https://foo.bar.ts.net/` (Origin headers do not include path; trailing slash in config is still wrong if present) | Prefer no trailing slash | Configure without path/slash |

CORS `allow_origins` uses the same list — keep SPA and API same-origin so credentialed CORS is mostly a belt-and-suspenders path; exact origin still matters for any cross-port mistakes.

### 5.5 Host-only cookies and MagicDNS renames

Cookies are **host-only** (no `Domain=` attribute in `cookies.py`). They bind to the exact host the browser used. Renaming the Tailscale machine changes the FQDN → **new origin → new empty cookie jar**. Operational implication: pick a stable machine name before inviting users; document renames as a re-login event.

### 5.6 Trust boundary notes (optional, not required for auth)

Serve injects identity headers (`Tailscale-User-Login`, etc.) for tailnet traffic. This app uses its **own** session cookies, not those headers, for account auth. If future code ever trusted those headers, the Serve docs’ rule applies: backend must be **localhost-only** so clients cannot spoof headers by hitting the port directly.

---

## 6. Compose-side expectations (interface only)

This research does not choose Caddy vs nginx (#78) or final compose layout (#76). Interface contract for Serve:

1. **Single** listen address preferred: `127.0.0.1:<router-port>` on the Tailscale node (or Docker publish to host loopback only).
2. Router serves:
   - `/` → SPA static assets (and SPA fallback as designed later)
   - `/api` → FastAPI
3. No TLS required on the router for the Serve path.
4. Health checks can use loopback HTTP; browser-facing health is `https://…ts.net/…` through Serve.

Port number itself is an implementation detail of the production Compose plan; Serve only needs the chosen loopback port.

---

## 7. Prerequisites checklist (operator)

| Step | Where |
| --- | --- |
| MagicDNS enabled | Admin console → DNS |
| HTTPS Certificates enabled | Admin console → DNS (accept CT publication) |
| Non-sensitive, stable machine name | Admin console → Machines (rename before certs if needed) |
| Tailscale client online on the VM | Host |
| Compose stack up; router on loopback port | Host / Docker |
| `tailscale serve --bg --https=443 http://127.0.0.1:<port>` | Host |
| App env: production + Secure cookies + exact `FRONTEND_ORIGINS` | Compose env / gitignored host env |
| ACLs allow intended users to the node/service | Tailnet policy (details TBD on map) |
| Confirm **not** running Funnel on 443 | `tailscale serve status` / avoid `tailscale funnel` |

---

## 8. Open items deferred to other tickets / map

| Item | Owner |
| --- | --- |
| Exact MagicDNS hostname once friend VM exists | Map #73 “Not yet specified” |
| Friend Tailscale ACL / tags | Map #73 |
| Caddy vs nginx as the internal router | #78 |
| Production Compose file layout | #76 |
| Full production env/cookie origin contract prose | #80 (blocked by this research) |
| SPA static build pattern | #79 |

---

## 9. Sources

### Tailscale (primary)

1. Tailscale Serve — https://tailscale.com/docs/features/tailscale-serve  
2. `tailscale serve` command — https://tailscale.com/docs/reference/tailscale-cli/serve  
3. Serve examples — https://tailscale.com/docs/reference/examples/serve  
4. Enabling HTTPS — https://tailscale.com/docs/how-to/set-up-https-certificates  
5. MagicDNS — https://tailscale.com/docs/features/magicdns  
6. Tailscale Funnel (contrast) — https://tailscale.com/docs/features/tailscale-funnel  

### App (repo)

- `backend/app/config.py` — production `cookie_secure` gate; origin parsing  
- `backend/app/cookies.py` — Secure / SameSite / paths  
- `backend/app/csrf.py` — Origin allowlist  
- `backend/README.md` — session security narrative  
- `backend/.env.example`, `backend/compose.yaml` — dev defaults (`COOKIE_SECURE=false`, localhost origin)

---

## 10. Bottom line

For map #73, the production HTTPS front door should be:

**Tailscale Serve (not Funnel) on HTTPS 443 → HTTP reverse proxy to one localhost Compose router**, with the browser origin **`https://<machine>.<tailnet>.ts.net`**, certificates auto-provisioned by Tailscale/Let's Encrypt for that FQDN, and app config **`COOKIE_SECURE=true`** plus **`FRONTEND_ORIGINS` set to that exact origin**. That satisfies Secure cookies, same-origin SPA+API, and Tailscale-only access without putting public TLS or public exposure into Compose.
