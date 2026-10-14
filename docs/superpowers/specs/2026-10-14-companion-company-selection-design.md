# Companion Company Selection Design

**Date:** 2026-10-14

## Goal

Allow public companions to use the primary attendee's company or enter another company, while administrative companion additions always inherit the primary attendee's company.

## Scope

This change affects company capture for companions only. It does not create a company catalog, change access rules, or alter the existing `Actividad profesional` category flow.

## Decisions

- Keep `company` as a text value on each attendee.
- The event configuration makes Company required for the primary attendee.
- Public companion registration exposes exactly two modes: `Misma empresa` and `Otra empresa`.
- `Misma empresa` is selected by default.
- In `Misma empresa`, the server copies the primary attendee's company.
- In `Otra empresa`, the server requires a non-empty companion company value.
- Administrative companion creation always copies the primary attendee's current company.
- Administrative creation ignores any client-provided company value.
- Later primary-company edits do not rewrite existing companion records.
- No public page, email, or external attendee surface receives internal-only category pills; this specification is limited to company inheritance.

## User Flow

### Public Registration

1. The registrant completes the required primary company field.
2. The registrant enables a companion.
3. The companion section defaults to `Misma empresa`.
4. The UI displays the primary company as the inherited value without making it directly editable.
5. Selecting `Otra empresa` reveals an editable required input.
6. The form submits the companion mode and companion company value.
7. The server resolves and validates the final stored company.

### Administrative Registration

1. An administrator searches for an existing registration.
2. The administrator opens the add-companion form.
3. The form does not expose a company selector or editable company input.
4. The server loads the primary attendee and copies its current company to the new companion.

## Data Flow

The public form sends an explicit mode alongside the existing company value:

```text
companionCompanyMode: "same" | "other"
companionCompany: string
```

The public server action applies these rules:

```text
mode === "same"  -> companion.company = primary.company
mode === "other" -> companion.company = trim(companionCompany), required
```

The server must resolve the primary attendee from the registration rather than trusting a primary-company value from the browser.

The administrative action applies:

```text
companion.company = primary.company
```

Any submitted company value from the administrative browser is ignored.

## Validation And Errors

- A primary registration without Company remains invalid because the event configuration requires it.
- `Misma empresa` is invalid if the resolved primary company is empty.
- `Otra empresa` is invalid when the trimmed value is empty.
- Validation errors remain inline and use the existing form error mechanism.
- Existing duplicate-email, capacity, permission, and event-state behavior remains unchanged.

## Component Boundaries

- `app/events/[id]/register-form.tsx` owns the companion mode control and conditional input visibility.
- `app/events/[id]/actions.ts` or the existing public registration action owns server-side mode validation and company resolution.
- `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx` does not render a company selector for administrative additions.
- `app/(protected)/events/[id]/internal-form/actions.ts` resolves the primary attendee and passes its company to the domain service.
- `src/modules/events/service.ts` remains the domain boundary for attendee creation; it receives the resolved company value and does not need a company catalog.

## Testing Requirements

- Public companion with `same` stores the primary company.
- Public companion with `other` stores the trimmed alternate company.
- Public companion with empty `other` company is rejected.
- Public companion with `same` and missing primary company is rejected.
- Public action does not trust a forged primary-company value from `FormData`.
- Administrative companion creation stores the primary company.
- Administrative action ignores a forged company value from `FormData`.
- Existing primary registration and companion flows continue to pass.

## Non-Goals

- No company normalization or deduplication.
- No company autocomplete or company catalog.
- No retroactive rewrite of existing companions when the primary company changes.
- No changes to `Actividad profesional`, category colors, or internal client-type pills.

## Self-Review

- No placeholders or unresolved decisions remain.
- Public and administrative paths have distinct, explicit company rules.
- Server-side validation is required for both modes; the UI is not the security boundary.
- Existing attendee storage remains compatible because the feature uses the current `company` field.
- The scope is bounded to companion company selection and inheritance.
