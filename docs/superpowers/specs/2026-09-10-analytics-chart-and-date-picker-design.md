# Analytics Chart and Date Picker Design

Standardize analytics date controls on a shared `DateRangePicker` backed by a base `Calendar`, while keeping QR scans and short-link clicks as separate analytics surfaces. This design authorizes planning only; it does not authorize implementation.

## Quick Path

1. Place shadcn-compatible UI components in `src/components/ui`, matching the existing `components.json` alias.
2. Use one shared date-range control across analytics views, normalizing selected dates from start-of-day through end-of-day.
3. Keep QR and Links charts separate, with their existing date range, granularity, CSV export, loading, and empty-state behavior.

## Decisions

| Topic | Decision |
|---|---|
| Shared controls | Existing and future analytics date controls use a shared `DateRangePicker` and base `Calendar`. |
| Component location | UI components live in `src/components/ui`; no competing root `/components/ui` directory is created. |
| QR analytics | The QR chart reports only `qr_scan` events. |
| Links analytics | The Links chart reports only `link_click` events. |
| Metric separation | No combined metric switcher is added. QR and Links remain distinct surfaces. |
| Retained controls | Both surfaces retain date range, granularity, and CSV export. |
| Date bounds | A selected range includes the full first and last calendar days: start-of-day through end-of-day. |
| Empty data | No-rollup-yet and empty responses remain honest; existing loading and empty states remain in place. |
| Dependencies | Reuse installed dependencies. Later implementation may add only calendar dependencies confirmed missing. |

## Implementation Boundaries

In scope for a later implementation:

- Shared calendar and date-range picker components under `src/components/ui`.
- Wiring the shared range control into QR and Links analytics views.
- Applying date bounds consistently to chart and CSV queries.

Out of scope:

- Application implementation in this task.
- A unified QR/Links chart or metric selector.
- Replacing existing loading or empty states.
- Adding dependencies before a later implementation confirms they are absent.
- Moving UI components to a root `/components/ui` directory.

## Verification Plan

- Run type checking and the production build.
- Verify QR filters return only `qr_scan` data.
- Verify Links filters return only `link_click` data.
- Verify date selection is keyboard accessible in the dark theme.
- Verify date ranges include both selected boundary days.
- Verify CSV export and granularity remain available on both surfaces.
- Verify no-rollup-yet, loading, and empty states remain truthful and intact.

## Self-Review

- No placeholders remain.
- Date behavior is explicit: inclusive start-of-day through end-of-day.
- QR and Links event boundaries do not overlap; a combined switcher is explicitly prohibited.
- Dependency additions are deferred to evidence gathered during implementation.
- Scope is limited to design; this document does not authorize code, manifest, style, lockfile, staging, or commit changes.

## Next Step

Use this document as the acceptance baseline for a separately authorized implementation task.
