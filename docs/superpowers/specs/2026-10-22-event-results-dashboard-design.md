# Event Results Dashboard Design

## Goal

Turn the event Results page into an operational dashboard that explains current demand, review workload, capacity usage, and recent activity using persisted event data.

## Scope

- Keep the existing summary metrics: visits, registrations, attendance, conversion, and confirmed people/capacity.
- Add registrations-by-day for the last 14 calendar days.
- Add a status distribution showing pending review, confirmed, waitlisted, and cancelled registrations.
- Add a five-row recent registrations list with a direct link to the registrations page.
- Add an attention panel for pending review, waitlisted people, confirmed people without check-in, and requested companions.

## Data Rules

- Confirmed occupancy continues to count active attendees belonging to confirmed registrations, including primary attendees and companions.
- Pending review, waitlisted, and cancelled registrations do not consume capacity.
- Registration activity is grouped by `event_registrations.created_at`.
- The dashboard must preserve empty states when no registrations exist.
- Counts must be scoped by event and organization through the existing event service boundary.

## Layout

1. Existing summary cards at the top.
2. Main two-column area on desktop:
   - Registration activity chart, wider column.
   - Attention panel, narrower column.
3. Lower two-column area:
   - Registration status distribution.
   - Recent registrations.
4. Collapse to one column on small screens without horizontal overflow.

## Visual Language

- Preserve the dark admin surface and segmented event navigation.
- Use the existing semantic tokens for accent, destructive, muted, and card surfaces.
- Charts must include visible labels and legends; color is never the sole status signal.
- Use restrained motion and preserve keyboard focus states.

## Verification

- Service tests cover activity buckets, status counts, attention counts, recent registrations, and empty data.
- Dashboard tests verify the new sections and empty states.
- Run lint, typecheck, build, and the Impeccable detector.
