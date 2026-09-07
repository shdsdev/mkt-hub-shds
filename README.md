# Marketing Hub

Internal, modular replacement for paid external SaaS tools (URL shortener, QR code generator) —
see `docs/SPEC.md` for the full product/technical specification, `docs/ARCHITECTURE.md` for the
modular-monolith design, `docs/DATABASE.md` for the schema, and `docs/ROADMAP.md` for the phased
delivery plan (Phase 0: this scaffold).

## Stack

Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui + Drizzle ORM + PostgreSQL.

## Getting Started

1. Copy `.env.example` to `.env.local` and adjust `DATABASE_URL` if needed.
2. Start Postgres: `docker compose up -d db`
3. Install deps: `npm install`
4. Run the dev server: `npm run dev`

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate Drizzle migrations from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio |

## Status

Phase 0 (Foundation) — toolchain scaffold only. No database tables yet; those land in Phase 1
(Auth + Database) per `docs/ROADMAP.md`.
