# Question Bank — Frontend

Web application for creating question papers and managing a question bank.
Built with React 19, TypeScript, Vite, TipTap, and Tailwind CSS.

This is the **frontend** repo. The API server lives in a separate repo
(`question-bank-backend`) and is deployed independently.

## Stack

| Layer          | Technology                              |
|----------------|-----------------------------------------|
| Framework      | React 19, TypeScript 6, Vite 8          |
| Editor         | TipTap 3 (ProseMirror)                  |
| Math           | KaTeX 0.18 (LaTeX formula library)      |
| Routing        | react-router 7                          |
| Notification   | Sonner toasts                           |
| Styling        | Tailwind CSS 4                          |
| Testing        | Vitest, @testing-library/react          |
| Linting        | ESLint 10, typescript-eslint            |

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- The backend repo running on `http://localhost:4000` (or a deployed API)

### Setup

```bash
npm install
```

### Development

```bash
npm run dev
```

Serves the app at `http://localhost:5173`. The Vite dev server proxies `/api/*`
to `http://localhost:4000`, so the backend must be running.

To run against a remote API instead, create `.env.local` with:

```bash
VITE_API_URL=https://<backend-url>
```

### Scripts

| Command              | Description                        |
|----------------------|------------------------------------|
| `npm run dev`        | Start Vite dev server (:5173)      |
| `npm run build`      | Production build to `dist/`        |
| `npm run preview`    | Preview the production build       |
| `npm test`           | Run tests                          |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run lint`       | Run ESLint                         |
| `npm run typecheck`  | TypeScript type-check              |

## Features

- **Question paper editor** — rich text (bold, italic, lists, alignment), A4 print
  layout, PDF export, Gujarati text input, math equations, and image support
- **Admin panel** (`/admin`) — authentication, users & roles/permissions, master
  data (standards, subjects, chapters, topics, exam types, languages, schools),
  question bank CRUD with edit history & usage analytics, and test management

## Project Structure

```
src/
  admin/          # Admin panel (auth, users, roles, questions, tests, analytics)
  api/            # API client (single touchpoint, reads VITE_API_URL)
  components/     # Shared UI components
  web/            # Question paper editor UI
  print/          # Print/PDF layout engine
  hooks/          # Custom React hooks
  extensions/     # Custom TipTap extensions
  utils/          # Utilities (incl. Gujarati/KAP helpers)
  test/           # Test setup
```

## Deploy (Vercel)

- Framework preset: Vite (auto-detected via `vercel.json`)
- Build: `npm run build` — output `dist/`
- Set the build-time env var `VITE_API_URL=https://<backend>.onrender.com`
  (it is inlined by Vite at build time)
- SPA rewrite configured in `vercel.json` so `/admin/*` deep links work

## Related

- Backend repo (Express + Supabase API)
- Supabase schema: see `migrations/` in the backend repo