# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct audiences on two different surfaces of this app:
- **Internal (Operate surfaces, `app/(protected)/**`):** Marketing Hub's own team at Shades de México (ADMIN/MARKETING_MANAGER/MARKETING_USER/VIEWER roles) — manage QR codes, short links, UTM campaigns, and (this session's scope) events.
- **External (Persuade surface, this request):** anonymous members of the public who land on a published event's page from a shared link/QR/ad, decide whether to register, and — if a companion is attending with them — register their companion too. They never see the admin UI.

[Inferred from README.md + module code; not confirmed in an interview this session — see disclosure below.]

## Product Purpose

Marketing Hub is Shades de México's internal, modular replacement for paid external SaaS marketing tools (URL shortener, QR generator, UTM builder, campaign/print-run tracking, analytics). The events module (this session) extends it to run an actual event end-to-end: admin creates and publishes an event → the public lands on its page and registers (with waitlist/capacity handling) → attendees get a QR pass + backup code by email → staff check them in at the door → admin reviews results afterward.

## Positioning

Not a general event-platform competitor (no page-builder, no ticketing/payments, no speaker bios by explicit design decision from this module's original spec) — it's the minimum real event flow a marketing team needs, built on the same org/auth/module foundation as the rest of the Hub, so events share infrastructure with everything else in the app rather than living in a separate tool.

## Operating Context

- Admin creates/edits/publishes/closes an event at `/events` → `/events/<id>/edit` (ADMIN only).
- Public lands at `/events/<id>` (the dynamic segment holds the event's slug) once published; registers themselves + optional companions.
- Confirmation/waitlist-promotion/reminder emails go out via Resend, each carrying a QR pass + backup code.
- Self-service cancellation via a signed link at `/events/cancel/<token>`.
- Staff check attendees in at `/events/<id>/check-in` (any active session, not ADMIN-gated) by scanning the QR or typing the backup code.
- Admin reviews registrations (`/events/<id>/registrations`, with CSV export) and results (`/events/<id>/dashboard`: visits/registrations/attendance/conversion) after the event.
- This session's immediate work: the public landing (`/events/<id>`) currently renders with zero visual design (plain unstyled text/inputs) — it needs a real designed surface. The content model is also being extended: a hero image, an agenda (ordered time+title blocks), and sponsor logos are being added so the landing has something worth designing around.

## Capabilities and Constraints

- Next.js App Router, React, TypeScript, Tailwind, shadcn/ui-derived primitives (`src/components/ui/*`), Drizzle ORM over Postgres (Supabase).
- Ten modules under `src/modules/<module>/`; `index.ts` is the only file other modules may import (`eslint-plugin-boundaries` enforces this).
- The public landing route has no session/auth and does not know the event's `organizationId` ahead of resolving it by slug.
- Explicit non-goals carried over from the original events-module spec: no drag-and-drop page builder, no speakers/ponentes section, no raffle engine, no guest/tokenless check-in, no centralized CRM.
- Strict TDD is the house convention for this module (service-layer logic and server actions are unit-tested; page-level components generally are not, per existing precedent in this codebase).

## Brand Commitments

Shades de México (observed from the auth email domain `@shades.lan` and prior session context — not independently confirmed this session). No logo file, brand guideline doc, or locked color palette found in the repo. The visual direction for this specific surface was set directly by the user: a premium, pastel-gradient, serif-italic wellness-storefront aesthetic (referencing the "YukoHealth Storefront" 21st.dev template's preview — soft blue→pink gradient headline, pill-shaped nav, soft 3D blob/gel imagery, generous whitespace on white) is the explicit brief for this landing page; it does not need to match the dark teal admin theme, since attendees never see the admin UI.

## Evidence on Hand

No real event copy, photography, sponsor logos, or agenda content exists yet — the one test event in the local DB ("workshop", slug "ss") has placeholder text ("dfsfsfdf" as its description). The landing's design must work correctly with that kind of sparse/placeholder content (empty states for no hero image, no agenda, no sponsors) since real content doesn't exist yet, not only once it's fully populated.

## Product Principles

1. The public landing is a stranger's one shot to decide whether to show up — design for a cold visitor with zero context, not for the team that already knows what the event is.
2. Draft/closed events are never publicly reachable; the landing route's only gate is the event's own `status` column — no separate preview/staging surface.
3. Registration must survive sparse admin input gracefully (no hero image, no agenda, no location) — empty states are a first-class design requirement, not an afterthought.
4. Admin surfaces (Operate mode) stay inside the existing dark Marketing Hub visual system; only the public landing/registration/cancel pages (Persuade mode) adopt the new premium direction.

## Accessibility & Inclusion

No product-specific requirement established this session.

---

**Disclosure:** This file was written by inferring product facts from the existing codebase (README.md, module structure, prior session history) rather than through a live structured interview, because the user had already spent significant time on direct implementation requests in this conversation and a fresh three-question round would have repeated ground already covered indirectly. The `## Users`, `## Brand Commitments`, and `## Evidence on Hand` sections carry the highest inference risk — flag anything there that's wrong.
