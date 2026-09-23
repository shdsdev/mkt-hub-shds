# Design: Bulk QR Configuration

Bulk website QR imports will gain a three-step wizard that validates the entire batch before creation, requires every batch to belong to exactly one organization-scoped grouping (a campaign or folder), applies that grouping and one visual design to every QR, and accepts UTM values per CSV row. This design supersedes the conflicting bulk-import decisions in `2026-09-10-bulk-qr-import-design.md`; it does not change static QR flows or the single-QR creation wizard.

## Quick Path

1. Upload a CSV that conforms to the exact header contract; the browser previews all rows and blocks advancement on any error.
2. Select exactly one organization-scoped folder or campaign for the batch and select, customize, or save one shared design template.
3. Review the complete batch and create it only after server-side preflight validation succeeds.

## Decisions

| Topic | Decision |
|---|---|
| Wizard | Three steps: CSV, batch configuration, review and create. It follows the existing QR wizard visual language but omits type selection because bulk supports dynamic website QRs only. |
| CSV UTM scope | UTM values belong to each CSV row, not to the batch. |
| Grouping | Exactly one folder **or** exactly one campaign is required and applied to every created QR. The submitted record must belong to the current organization. Omitting both IDs or submitting both IDs is invalid. |
| Design | One design snapshot is applied to every QR. Operators may apply an existing template, customize its fields, and optionally save the resulting fields as a new template. Created QRs never retain a live template reference. |
| Validation | The client provides immediate feedback, but the server validates every row and all batch configuration before its first mutation. Any validation failure creates zero records. |
| Execution | After successful preflight, rows execute sequentially in CSV order. Completed rows remain successful if a later service operation fails. |

## Wizard And Data Flow

### Step 1: CSV

The page downloads an authenticated template and accepts a local CSV only; the file is never persisted. The header must exactly be:

```csv
url,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content
```

`url` and `title` are required. The five UTM columns are optional per row, but when present each value is trimmed, normalized with the existing UTM normalization policy, and limited to 255 characters. Empty optional fields persist as absent values. Quoted fields, escaped quotes, LF, and CRLF are supported. Blank lines are ignored. A file has at most 200 data rows.

Every non-blank data row must contain exactly seven fields, have a unique one-based row number, a non-empty title of at most 255 characters, and an `http://` or `https://` destination of at most 2048 characters. The parser reports malformed quoting, an invalid header, an over-limit file, and every invalid row. There are no ready-row-only submissions: one invalid or excluded row blocks the whole batch until the source is corrected.

### Step 2: Batch Configuration

The operator chooses exactly one folder or one campaign from the organization-scoped existing selectors. The form cannot advance without one selection and cannot submit both IDs. The selected record must still exist and belong to the current organization when creation begins.

The shared design starts from the current safe website-QR defaults or a selected organization-scoped template. Existing design controls provide colors, error correction, logo, and QR shapes. "Save as template" requires a non-empty template name of at most 255 characters. The saved template and each QR receive copied design fields; template changes never alter existing QRs.

### Step 3: Review And Create

The review presents the row count, row-level destinations and UTM presence, the selected grouping, and the exact design snapshot. The create control stays disabled until the client has no validation errors and prevents duplicate submission while pending. The server repeats all validation; client state is not trusted.

```text
CSV + shared configuration
          |
          v
server preflight: auth, rate limit, CSV, UTM, group, template input, domain
          |
          +-- invalid --> no mutations; structured batch/row errors
          |
          v
row 1: link -> short link -> dynamic QR -> audit
row 2: link -> short link -> dynamic QR -> audit
remaining rows follow the same sequential operation
```

## UTM And Link Contract

UTM columns are the sole attribution source for a bulk row. A destination URL containing any query parameter whose ASCII case-insensitive name is `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, or `utm_content` is invalid. This prevents two competing values because redirect resolution currently sets persisted UTM fields onto the destination URL.

For valid rows, the raw destination URL is persisted without UTM parameters and the normalized CSV values are stored on the link. At redirect time, persisted link UTM values are appended or replace the same parameter names; no request-supplied value influences the redirect.

Dynamic website QR UTM values become editable after creation. The edit action must authorize the link against the current organization, validate and normalize all five UTM fields, reject a destination that contains reserved UTM parameters, update only the link's UTM columns, write an audit event with before/after UTM values, and revalidate relevant link/QR views. It must not update `qr_codes`, `short_links`, the QR image payload, or the short-link slug. Existing printed QRs and short URLs therefore continue resolving; only future redirects use the edited attribution.

## Errors And Atomicity

Preflight failures include unauthenticated access, rate limiting, missing domain, invalid CSV/header/row, reserved UTM parameters in a destination, invalid design/template input, a missing grouping, both grouping IDs, or an invalid or foreign grouping. They return structured Spanish UI messages and create no link, short link, QR, audit record, or template.

The application has no cross-service database transaction for the existing link -> short link -> QR sequence. This design preserves that model after preflight: rows run sequentially, a failure is reported against its row, and subsequent rows continue. Earlier successful rows are retained; a failure within one row can leave the same partial link or short-link state already possible in the single-QR flow. A successful QR is audited, and `/qr` is revalidated once when at least one QR is created. Template creation occurs only after batch preflight and follows the same non-transactional posture; if it fails, no QR creation starts.

## Testing Strategy

| Layer | Coverage |
|---|---|
| CSV unit tests | Exact header, quoting, CRLF, blank lines, seven-field rows, 200-row boundary, required fields, UTM length, and reserved UTM detection including casing. |
| Wizard tests | Step progression, blocked advancement and submit until exactly one shared folder or campaign is selected, rejection of both IDs, template application/save input, review snapshot, and duplicate-submit prevention. |
| Server-action tests | Authentication, rate limit, required exactly-one organization-scoped group validation, complete preflight with zero mutations for any invalid row, UTM normalization, sequential call order, copied design/group fields, mixed execution failures, audit, and single revalidation. |
| UTM edit tests | Organization authorization, validation and normalization, audit before/after, unchanged QR/short-link identifiers, and redirect URL construction from edited persisted values. |
| Browser verification | Template download, Spanish validation/results, invalid-batch zero creation, successful shared configuration, and an existing printed QR continuing to resolve after a UTM edit. |

## Scope And File Plan

| Area | Intended change |
|---|---|
| `app/(protected)/qr/bulk/*` | Replace the two-field importer experience with the three-step wizard, seven-column parser, preview, and review. |
| `app/(protected)/qr/actions.ts` | Extend the bulk action with preflight and shared configuration; add the dynamic-link UTM edit action. |
| `src/modules/links/*` | Add organization-scoped persisted-UTM update support and preserve redirect construction. |
| QR/link tests | Add focused parser, action, redirect, and UI coverage. |

No schema change or migration is required: links already hold the five UTM fields, QR codes already hold design and folder/campaign fields, and saved design templates already exist. Out of scope: static QRs, per-row grouping or design, CSV storage/history, queues, rollback/cleanup compensation, changing the single-QR wizard, and changing the redirect's request-independent security model.

## Self-Review

- All requirements are concrete and finalized; no deferred product decision remains.
- The CSV header, optionality, UTM precedence, required exactly-one organization-scoped grouping, validation gate, and execution semantics are explicit and non-conflicting.
- "Complete validation before creation" applies to all submitted rows and shared configuration; later operational failures retain the existing sequential partial-success behavior.
- The scope is documentation only for this task. No product code, migration, or non-design file is authorized.
