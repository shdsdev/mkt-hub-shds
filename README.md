# Marketing Hub

Internal, modular replacement for paid external SaaS tools (URL shortener, QR code generator) —
see `docs/SPEC.md` for the full product/technical specification, `docs/ARCHITECTURE.md` for the
modular-monolith design (including ADR-005: Supabase), `docs/DATABASE.md` for the schema, and
`docs/ROADMAP.md` for the phased delivery plan.

## Stack

Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui + Drizzle ORM + **Supabase**
(Postgres + Auth + Storage).

## Getting Started

1. Copy `.env.example` to `.env.local`.
2. Start the local Supabase stack: `supabase start` (Postgres + Auth + Storage in Docker, free,
   no account needed). It prints the local API URL, anon key, and service role key — put those in
   `.env.local`.
3. Install deps: `pnpm install`
4. Run the dev server: `pnpm dev`

Open [http://localhost:3000](http://localhost:3000).

### Running the app itself in Docker against the local Supabase stack

`docker compose up` builds and starts the `app` service correctly, but a `DATABASE_URL` of
`127.0.0.1:54322` in `.env` won't resolve from *inside* that container — `127.0.0.1` there means
the container itself, not your machine. For `pnpm dev` (runs on the host) `127.0.0.1` is correct;
if you specifically need the containerized app to reach the local Supabase stack, override
`DATABASE_URL` to use `host.docker.internal` instead of `127.0.0.1` for that run. Against a real
(non-local) Supabase project this doesn't apply — `DATABASE_URL` is already a real hostname.

### Provisioning a real Supabase project

Not required for Phase 0 (local dev works fully offline). When ready to deploy: create a project
at [supabase.com](https://supabase.com) (or via the Supabase MCP tools, with explicit
confirmation — creating a project is a real, billable, account-scoped resource, so this is never
done automatically), then point `.env` at its `DATABASE_URL` (direct connection, not the pooler —
`drizzle-kit` migrations are unreliable through the transaction pooler) and API keys.

### Daily analytics rollup

`POST /api/jobs/rollup` aggregates the previous day's `tracking_events` into
`tracking_rollup_daily`. It's guarded by a bearer token — set `ROLLUP_JOB_SECRET` in `.env` and
point a free external cron (e.g. [cron-job.org](https://cron-job.org)) or your host's own cron at
it once daily:

```bash
curl -X POST https://your-domain/api/jobs/rollup -H "Authorization: Bearer $ROLLUP_JOB_SECRET"
```

Idempotent — safe to re-run or to miss a day and catch up on the next run.

## One-command check

```bash
pnpm check   # lint + typecheck + test + build
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint (includes `eslint-plugin-boundaries` — enforces ARCHITECTURE.md I-4) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm check` | The one documented command: lint + typecheck + test + build |
| `pnpm db:generate` | Generate Drizzle migrations from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Drizzle Studio |

## Module Shape

Ten modules under `src/modules/<module>/`, each with `index.ts` (public surface — the only file
other modules may import), `service.ts`, `db.ts`, and `http.ts`. `eslint-plugin-boundaries` fails
`pnpm lint` on any cross-module import that bypasses `index.ts`.

## Status

Phases 0-7 complete per `docs/ROADMAP.md`: Foundation, Auth + Database, Link Management Core,
Redirect Engine, UTM Builder, QR Generator, Campaigns/Print Runs, Analytics. Remaining: Phase 8
(Dashboard), Phase 9 (Security + Audit), Phase 10 (Testing + Production).
