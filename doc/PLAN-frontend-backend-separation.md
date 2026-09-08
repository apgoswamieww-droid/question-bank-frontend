# Frontend / Backend Separation — Deployment Plan (Vercel + Render)

> **Goal**: Split the single-repo full-stack project into two independently deployable
> halves — the **frontend (Vite React SPA)** hosted on **Vercel** and the **backend
> (Express API)** hosted on **Render** — while keeping a single git repo and a single
> `npm run dev` workflow for local development.

---

## 1. Current Architecture (Before)

- **Single package** — one root `package.json` mixes frontend + backend dependencies.
- **Frontend**: Vite + React + TypeScript SPA in `src/`, built to `dist/`.
- **Backend**: plain ESM JavaScript Express server in `server/` (~1256-line `index.js`),
  using Supabase via service-role key, with a JSON-file fallback for offline dev.
- **Dev communication**: Vite dev server proxies `/api/*` → `http://localhost:4000`
  (`vite.config.ts` → `server.proxy`).
- **Prod communication**: all API calls go through ONE function,
  `request()` in `src/api/client.ts:128`, which does `fetch('/api${path}')`
  (relative path, relies on the proxy / same-origin).
- **CORS**: already open — `app.use(cors({ origin: true, credentials: true }))` in
  `server/index.js:108`. Auth is **Bearer-token based** (no cookies), so cross-origin
  deployments only need the `Authorization` header — no cookie/credentials handling.

```
┌──────────────────┐  /api proxy (dev only)   ┌──────────────────┐
│ Frontend (root)  │ ───────────────────────▶ │ Backend          │
│ Vite dev server  │  ── production: none ──  │ server/:4000     │
└──────────────────┘                          └───────┬──────────┘
                                                      │
                                                Supabase (Postgres)
```

---

## 2. Target Architecture (After)

```
┌─────────────────────┐   HTTPS w/ Bearer JWT    ┌─────────────────────┐
│ Frontend           │  ──────────────────────▶ │ Backend             │
│ Vercel (static)    │  VITE_API_URL base        │ Render (Node 22)    │
│ Base URL: /        │  + /api prefix            │ server/ dir         │
└─────────────────────┘                          └──────────┬──────────┘
                                                           │
                                                   Supabase (Postgres)
```

- Both halves keep sharing **one git repo** and **the same Supabase database**.
- Vercel builds only the **frontend** from the repo root.
- Render runs only the **backend** from the `server/` directory.
- Local dev remains unchanged: `npm run dev` boots both together.

---

## 3. File Changes Summary

| File | Change | Why |
|---|---|---|
| `server/package.json` | **NEW** — own manifest + `start`/`dev`/`seed` scripts + backend-only deps | Render start command, dependency isolation |
| `package.json` | Remove backend deps; point dev/seed scripts at `--prefix server`; add `postinstall` | Vercel builds only frontend deps |
| `src/api/client.ts` | Read `VITE_API_URL` and prefix fetch URL | Point to Render in prod, keep proxy in dev |
| `src/vite-env.d.ts` | Type `VITE_API_URL` on `ImportMetaEnv` | TypeScript correctness |
| `vite.config.ts` | `base: "./"` → `base: "/"` | Fix SPA deep-link asset loading on Vercel |
| `vercel.json` | **NEW** — build/output + SPA rewrite | Vercel deploy config |
| `.gitignore` | Add `server/.env` | Never commit secrets |
| `.github/workflows/ci.yml` | Add `npm ci --prefix server` | CI installs backend deps too |

---

## 4. Detailed Changes

### 4.1 `server/package.json` (new file)

```jsonc
{
  "name": "question-bank-server",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "seed": "node seed.js",
    "seed:master": "node seedMasterData.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.112.4",
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "nodemailer": "^9.0.6"
  }
}
```

After the first `npm install`, a `server/package-lock.json` is generated and **must be
committed** so Render's `npm ci` is reproducible.

### 4.2 Root `package.json`

The six backend-only deps move out of root `dependencies`:
`@supabase/supabase-js`, `bcryptjs`, `cors`, `express`, `jsonwebtoken`, `nodemailer`.

Scripts become:

```jsonc
"scripts": {
  "dev": "concurrently -k \"npm --prefix server run dev\" \"vite\"",
  "dev:web": "concurrently -k \"npm --prefix server run dev\" \"vite\"",
  "dev:admin": "npm run dev:web",
  "build": "vite build",
  "preview": "vite preview",
  "server": "npm --prefix server run dev",
  "seed": "npm --prefix server run seed",
  "seed:master": "npm --prefix server run seed:master",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "postinstall": "npm --prefix server install"
}
```

> `postinstall` makes a single root `npm install` bootstrap both halves automatically.

### 4.3 `src/api/client.ts`

Add near the top (after the storage declarations):

```ts
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
```

Change the fetch in `request()` (line ~128):

```ts
const response = await fetch(`${API_BASE_URL}/api${path}`, {
```

Behavior:
- **Dev**: `VITE_API_URL` empty → `{API_BASE_URL}` is `""` → still hits `/api` via the
  Vite proxy. No change.
- **Prod (Vercel)**: `VITE_API_URL=https://<backend>.onrender.com` (set at build time) →
  requests go to `https://<backend>.onrender.com/api/...` with the same Bearer token.

### 4.4 `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 4.5 `vite.config.ts`

Change `base: "./"` → `base: "/"`.

> **Why required**: with `base: "./"` and `BrowserRouter`, a browser reload on
> `/admin/dashboard` resolves asset URLs like `./assets/main.js` to
> `/admin/assets/main.js`, which Vercel rewrites to `index.html` — breaking the app.
> Absolute base fixes deep-link reloads. Local dev is unaffected.

### 4.6 `vercel.json` (new file)

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- Vercel serves real static files (e.g. `/assets/*`) first, then applies the rewrite,
  so every `/admin/*` route falls back to `index.html` for the SPA.
- Equivalent settings can be configured in the Vercel dashboard instead.

### 4.7 `.gitignore`

```gitignore
# Backend environment (Render dashboard supplies these)
server/.env
```

> `server/.env` currently holds real Supabase service-role + Mailtrap credentials.
> It is untracked today — keep it that way. On Render, mirror its values into the
> dashboard env vars.

### 4.8 `.github/workflows/ci.yml`

After the existing `npm ci` step, add:

```yaml
      - name: Install backend dependencies
        run: npm ci --prefix server
```

Lint / typecheck / test / build stay root-only (ESLint covers `src/**/*.{ts,tsx}` only;
the backend is plain JS and not linted).

---

## 5. Deployment Configuration

### 5.1 Vercel (Frontend) — repo root, no subdirectory

| Setting | Value |
|---|---|
| Framework | Vite (auto-detected) |
| Root Directory | `/` (repo root) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Env var (build time) | `VITE_API_URL=https://<your-app>.onrender.com` |

Notes:
- `VITE_API_URL` is **inlined at build time** by Vite — must exist in the Vercel
  production (and preview) environment before building.
- Deploy the **entire repo**; Vercel ignores `server/` because the build only runs Vite.

### 5.2 Render (Backend) — Web Service

| Setting | Value |
|---|---|
| Type | Web Service |
| Runtime | Node (22) |
| Root Directory | `server` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Instance | Free tier is OK for testing (cold-starts ~30–60s after inactivity) |

Environment variables (mirror current `server/.env` values in dashboard):

| Variable | Notes |
|---|---|
| `PORT` | **Do not set** — Render injects this |
| `JWT_SECRET` | strong secret |
| `JWT_EXPIRES_IN` | `8h` |
| `SUPER_ADMIN_USERNAME` | `admin` |
| `SUPER_ADMIN_EMAIL` | e.g. `admin@yourdomain.com` |
| `SUPABASE_URL` | current Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only, never exposed to the client |
| `MAIL_ENABLED` | `true` / `false` |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` | SMTP settings (Mailtrap for dev) |
| `MAIL_USER` / `MAIL_PASS` | SMTP credentials |
| `MAIL_FROM` | `Question Bank <no-reply@...>` |
| `APP_BASE_URL` | **the Vercel frontend URL** — used for password-reset links |

Notes:
- `server/config.js` reads `process.env` first and only falls back to `.env` files, so
  dashboard env vars "just work" on Render — **no code change needed**.
- Same Supabase project as local (as decided) — data carries over automatically.
- Optional: add `CORS_ORIGINS` support to `server/index.js:108` to restrict the
  permissive `origin: true` to your Vercel domain.

### 5.3 Cross-origin checklist

- Auth is Bearer-token (no cookies) → `credentials: "same-origin"` in the client is fine.
- CORS on Render is currently wide open (`origin: true`) → frontend requests succeed.
- Email links (forgot/reset password) must use the **Vercel** URL via `APP_BASE_URL`.

---

## 6. Local Development (Unchanged Experience)

```bash
npm install          # root deps + bootstraps server/ deps (postinstall)
npm run dev          # boots Express (:4000) + Vite (:5173) together
npm run seed         # seeds roles/permissions/super-admin
npm run seed:master  # seeds standards/subjects/chapters/topics
npm test             # vitest
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (ts/tsx only)
```

Or run halves independently:

```bash
npm run server       # backend only
npm run dev -- --web # (frontend only via "vite"; not wired as a named script)
```

---

## 7. Verification Checklist

1. `npm install` at root — confirms `postinstall` bootstraps `server/`.
2. `npm run dev` — app loads at `:5173`, admin API works through the proxy.
3. `npm run typecheck` and `npm run lint` — clean.
4. `npm test` — frontend tests pass.
5. `npm --prefix server run seed` / `seed:master` — DB seeded.
6. `npm run build` — produces `dist/`; confirm asset URLs are absolute (`/assets/...`).
7. Local end-to-end with `VITE_API_URL` set — open the built `dist/` served from a static
   server and verify cross-origin calls to a locally running Express on `:4000` succeed.
8. After deploying: test `/admin`, deep-link reload on `/admin/dashboard`, login,
   forgot-password email link, and a cold-start of the Render instance.

---

## 8. Rollback

- Revert the config-file changes; both halves still function as the original single
  package.
- `git revert` the separation commit → restore root deps and original scripts.
- No data migration — the Supabase schema and data are untouched.

---

## 9. Related Files & Notes

- All frontend→backend traffic funnels through `src/api/client.ts` (single touchpoint —
  keeps the base-URL change trivial).
- Backend route map, env var behavior, and DB schema details: see
  `server/index.js`, `server/config.js`, `server/migrations/*.sql`.
- CI pipeline: `.github/workflows/ci.yml`.
- Marketing/branding copy for a SaaS context: `doc/PLAN-question-bank-saas.md`.