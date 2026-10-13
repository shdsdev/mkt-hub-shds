# Improve Event Registration Review

The registrations screen will become a focused review workspace: a wide, scannable table for
triage and a right-side detail sheet for the complete registration. Status tabs will separate the
main workflows without hiding the existing search, CSV export, or companion actions.

## Quick Path

1. Open `/events/[id]/registrations`.
2. Use the status tabs or search to narrow the server-rendered result set.
3. Click any registration row to open its complete detail in a right-side sheet.
4. Use the sheet for attendee data, preferences, UTM attribution, pass/check-in details, and
   follow-up actions.

## Design Decisions

| Area | Decision |
| --- | --- |
| Layout | Full-width protected event workspace rather than the current narrow `max-w-4xl` layout. |
| Table | Keep the table server-rendered and horizontally scrollable. Show contact, status, date, brands, interests, companions, pass, follow-up, and source. |
| Row interaction | The full row is clickable and keyboard-focusable. Selecting a row opens the detail sheet. Interactive cells such as email links and action buttons stop propagation. |
| Status filtering | Preserve URL query parameters with tabs for Todos, Confirmados, Lista de espera, Cancelados, and Check-in. Counts are shown only when available without introducing a second query. |
| Search | Preserve the existing server-side `q` search and keep it synchronized with the active status tab. |
| Detail | Use the existing Sheet primitive from the right side. Organize content into Registro, Contacto, Preferencias, Asistentes, Origen, and Acciones sections. |
| Existing actions | Preserve CSV export and add-companion behavior. Move the primary add-companion action into the detail context while retaining an accessible row-level entry point. |
| Data model | No database migration. The current registration and attendee data already contains the required values. |
| Responsive behavior | Desktop uses the wide table plus right sheet. Mobile uses horizontal table scrolling and a full-width sheet/drawer presentation with the same sections. |

## Data Flow

- `RegistrationsPage` reads `status` and `q` from `searchParams` and calls `listRegistrations`.
- The page passes the returned registration rows to a client table shell without duplicating the
  database query in the browser.
- Row selection is local UI state containing the selected registration ID or record.
- `RegistrationDetailSheet` renders the selected registration and closes without changing the URL.
- Status tabs and search remain normal links/forms so refresh, back/forward, and CSV export preserve
  the active filter.

## Table Information Architecture

The table prioritizes decisions an operator makes repeatedly:

- Contact: primary name and email.
- Status: confirmed, waitlisted, cancelled, or check-in.
- Date: registration timestamp.
- Brands: selected client brands.
- Interests: selected interests.
- Companions: count, not the full list.
- Pass: pending or checked in.
- Follow-up: requested additional companions.
- Source: public/admin source or the primary UTM source.

Long values are truncated visually but remain available in the detail sheet. The table must never
render action controls as a narrow unrelated column that causes the main data to wrap.

## Detail Sheet Sections

- Header: primary attendee, registration status, timestamp, and source.
- Contact: email, phone, company, job title, and professional activity.
- Preferences: brands, interests, consent timestamps, and additional-companion request.
- Attendees: each attendee's identity, contact details, activity, backup code, and check-in state.
- Attribution: all populated UTM values and registration source.
- Actions: add companion, resend confirmation when supported, and view/download pass when supported.

## Acceptance Checklist

- [ ] The registration workspace uses the available width on desktop.
- [ ] Tabs visibly identify the active status and preserve search parameters.
- [ ] The table exposes the agreed high-value columns without becoming unreadable.
- [ ] Clicking a row opens the right-side detail sheet.
- [ ] Keyboard users can focus and activate a row.
- [ ] Email links and nested action controls do not accidentally open the row detail.
- [ ] The sheet organizes all current registration, attendee, preference, UTM, and pass data.
- [ ] Existing CSV export and companion actions continue to work.
- [ ] Mobile keeps the table usable through horizontal scrolling and presents a readable detail sheet.
- [ ] No database migration is generated or required.

## Out Of Scope

- New registration fields or schema changes.
- Server-side pagination beyond the existing filtered query.
- Bulk selection or bulk actions.
- Changes to public registration or check-in flows.
