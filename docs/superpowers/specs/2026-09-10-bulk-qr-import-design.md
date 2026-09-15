# Bulk QR Import Design

Add a dedicated, authenticated `/qr/bulk` workflow for creating up to 200 dynamic website QR codes from a CSV. It gives operators a Spanish template, local preview, and row-level outcome report while preserving the existing single-QR creation flow unchanged.

## Quick Path

1. An authenticated user opens `/qr/bulk` and downloads the Spanish CSV template or selects a CSV file.
2. The browser parses and previews valid and invalid rows before any server request; at most 200 data rows are accepted for processing.
3. One server action processes valid preview rows sequentially using the established link, short-link, and dynamic-QR service operations, then reports each row's result without rollback.

## Decisions

| Topic | Decision |
|---|---|
| Entry point | Add a dedicated `/qr/bulk` route. The existing create-QR modal and all single-QR screens remain unchanged. |
| CSV shape | The template and importer use two columns: `URL` and `Titulo del codigo QR (referencia)`. Quoted CSV fields and CRLF line endings are supported. |
| Template | `GET /qr/bulk/template` remains authenticated and returns `plantilla_codigos_qr.csv` with Spanish headings and examples. |
| Client processing | Read and parse the selected file in the browser, skip blank lines, validate structure and values, enforce the 200-row limit, and show a preview before creation. No uploaded CSV is persisted. |
| Title policy | A missing or whitespace-only title is an invalid row and is not submitted for creation. This follows the current dynamic QR contract, where `name` is trimmed and requires at least one character. The import must not generate a fallback title such as `QR sin nombre`; that existing migration backfill is for historic records, not new input. |
| URL policy | A destination must be non-empty and begin with `http://` or `https://`, matching the existing link-service validation. Invalid URLs are reported against their CSV data-row number. |
| Limit | Process no more than 200 data rows per import. Rows beyond the limit are reported as excluded before submission and are never sent to the server action. |
| Domain guard | The server action authenticates first, then confirms the organization has a domain before creating any row. If no domain exists, it returns one Spanish batch-level error and creates nothing. |
| Creation sequence | For each eligible row, create a link, create its auto-slug short link on the selected organization domain, then create a dynamic QR. Reuse `createLink`, `createShortLink`, and `createDynamicQrCode`; do not duplicate database access or QR generation logic. |
| Execution order | Process rows sequentially in input order. This keeps result ordering deterministic and uses the same service posture as the existing website QR action. |
| Failure semantics | Keep successful rows. A failed row is recorded with its row number, title, and Spanish error; subsequent rows continue. There is no transaction and no batch rollback. A failure between the three existing operations may leave the same partial link/short-link state already accepted by the single-QR flow. |
| QR defaults | Imported dynamic QRs use the existing safe website-QR defaults for appearance. The CSV governs destination and title only; it does not introduce bulk UTM, grouping, placement image, templates, logos, or per-row design settings. |
| Cache refresh and audit | Each successfully created QR receives the same create audit record as the individual action. Revalidate `/qr` once after the batch finishes if at least one QR was created. |
| User-facing language | All labels, instructions, validation messages, preview headings, progress status, and final results are Spanish. |

## Approaches Considered

| Approach | Outcome |
|---|---|
| Client preview with one sequential server action | Chosen. It prevents obvious bad input before mutation, preserves server-side authorization and service validation, and gives deterministic partial-success results. |
| Upload CSV and parse only on the server | Rejected. It adds a file-transfer step and delays actionable preview feedback without a product need to retain files. |
| Parallel row creation or one database transaction | Rejected. Parallel writes complicate ordering and rate/error behavior; a transaction conflicts with the approved requirement to retain successful rows after independent failures. |

## Components And Data Flow

### Route and template

- The protected `/qr/bulk` page is the only new user entry point.
- It offers a template download and a file picker limited to CSV input.
- The existing authenticated template route stays scoped to template delivery; it does not create QR codes.

### Browser preview

- The parser treats the first non-blank record as the header and ignores its labels. Every non-blank data record must contain exactly two CSV fields in template order: URL first, title second; otherwise it is an invalid row.
- Each data row retains its original one-based data-row number, excluding the header, so preview and final failure reports identify the same row.
- A row with an empty title or invalid URL is shown as invalid and excluded from the create request.
- Blank lines are ignored.
- If the file is empty, malformed, or has no usable data rows, the UI explains the condition in Spanish and prevents submission. When more than 200 data rows are present, it explains that rows after the first 200 are excluded and allows submission of the first 200 only.
- The preview clearly separates ready rows, invalid rows, and rows excluded by the 200-row limit. The create control displays the exact number of rows that will be sent.

### Server action

- The action obtains the current user and redirects unauthenticated callers to `/login`, consistent with existing QR actions.
- It validates the submitted row array again. Client parsing is usability support, not an authorization or integrity boundary.
- It applies the existing rate-limit check before mutations and returns its existing Spanish rate-limit message when blocked.
- It loads the organization's domains once. A missing domain is a batch-level guard failure: no row processing starts.
- For each validated row, in source order, it calls the existing services with the user's organization ID and the selected domain ID:
  1. `createLink` with the row URL.
  2. `createShortLink` with the new link and domain.
  3. `createDynamicQrCode` with the new link, short link, title, and the existing default website-QR customization.
- On success, it records the QR create audit event and appends a success result. On failure, it appends a failure result and continues with the next row.
- The action returns a typed summary containing requested, created, failed, and per-row results. It never reports a row as created unless all three operations completed and a QR ID exists.

### Results

- While processing, the UI disables duplicate submission and displays a Spanish in-progress state.
- Completion shows totals first, then a row-level list: successful rows with their QR identity, and failed rows with row number, title, and error.
- The user can return to `/qr` after completion to see newly created QRs. Failed rows remain visible in the result view for correction and retry through a new import.

## Boundaries

### In Scope

- Protected `/qr/bulk` import page and navigation entry appropriate to the QR area.
- Authenticated CSV-template download.
- Browser CSV parsing, validation, preview, and 200-row enforcement.
- One sequential server action for dynamic website QR creation.
- Per-row partial-success reporting with Spanish copy.
- Reuse of existing links and QR service operations, authentication, rate limiting, audit records, and QR-list revalidation.

### Out Of Scope

- Any modification to the current single-QR modal, website form, static QR forms, or their server actions.
- Static QR types.
- Batch UTM values, folders, campaigns, placement images, templates, logos, or per-row QR styling.
- Rollback, delete/cleanup compensation, concurrency controls, queueing, background jobs, or progress persistence.
- CSV storage, import history, export of results, and retrying only failed rows.
- New packages, schema changes, migrations, database tables, or service-layer replacements.

## Acceptance Checklist

- [ ] `/qr/bulk` requires authenticated access.
- [ ] The template download requires authenticated access and supplies the documented two Spanish columns.
- [ ] The browser previews CSV rows before creation and ignores blank lines.
- [ ] Invalid URLs and empty titles identify their one-based data-row number in Spanish.
- [ ] A title consisting only of whitespace is rejected; no automatic name is generated.
- [ ] No more than 200 data rows are submitted or processed.
- [ ] Without an organization domain, the action creates no records and returns the Spanish domain guidance.
- [ ] Every eligible row is processed sequentially through link, short-link, and dynamic-QR creation.
- [ ] One failed row does not prevent later valid rows from being attempted.
- [ ] The final report distinguishes each success from each failure and leaves successful rows intact.
- [ ] The existing single-QR flow has no behavioral or UI change.

## Verification Plan

- Add parser coverage for header handling, quoted fields, CRLF, blank lines, invalid URLs, empty and whitespace-only titles, empty files, malformed rows, and the 200-row boundary.
- Add server-action coverage for unauthenticated access, rate limiting, no-domain guard, service call order, success audit/revalidation, and a mixed success/failure batch that continues after an error.
- Verify in the browser that the template downloads, preview labels are Spanish, submission is disabled while running, and the results view accurately presents mixed outcomes.
- Verify the individual website and static QR flows remain unchanged.

## Self-Review

- No `TODO`, `TBD`, placeholders, or deferred product decisions remain.
- Title handling is explicit and follows the current required-name contract; the historic migration fallback is deliberately excluded.
- The 200-row boundary, client/server validation split, domain precondition, and partial-success behavior are defined without competing interpretations.
- The design reuses the existing link, short-link, QR, authentication, rate-limit, audit, and revalidation operations rather than introducing a parallel creation path.
- Scope is limited to a future bulk dynamic-website QR feature. It neither changes nor authorizes changes to the single QR flow, schema, dependencies, tests, Git staging, or commits.

## Next Step

Use this document as the approved implementation baseline for a separately authorized task.
