# Bulk QR Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a validated three-step dynamic website QR batch wizard with per-row UTM attribution, one required shared organization-scoped group and design, plus safe post-creation UTM editing.

**Architecture:** Keep CSV parsing, row normalization, reserved-UTM detection, and client wizard eligibility as pure functions under `app/(protected)/qr/bulk`, then repeat all trust-boundary validation in the QR server action before any mutation. The action creates an optional design template only after preflight, then preserves the current sequential link-to-short-link-to-QR execution semantics. Persisted UTM changes belong solely to `links`; the QR edit modal invokes a QR-scoped action that authorizes the linked dynamic QR and never writes QR or short-link records.

**Tech Stack:** Next.js 16.3.4 App Router and Server Actions, React 19.2.8, TypeScript 5, Zod 4.5.4, Drizzle ORM/Postgres, Vitest 5, pnpm 11, Node 22.

## Global Constraints

- Bulk import supports dynamic website QRs only; do not change static QR flows or the single-QR creation wizard.
- The CSV header is exactly `url,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content` in that order and casing.
- A batch contains at most 200 non-blank data rows; every submitted row must be valid, so ready-row-only submission is forbidden.
- `url` and `title` are required; URLs must be `http://` or `https://`, at most 2048 characters, and titles are at most 255 characters.
- Each optional UTM field is trimmed, normalized with `normalizeUtmValue`, limited to 255 characters, and persisted as absent when empty.
- A destination containing an ASCII-case-insensitive reserved `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, or `utm_content` query parameter is invalid.
- Every batch requires exactly one organization-scoped folder or campaign; neither selection and both selections are invalid.
- Every batch uses one copied design snapshot, optionally copied from an organization-scoped template; no created QR retains a live template reference.
- Saving a template requires a non-empty, trimmed name of at most 255 characters and occurs only after all preflight validation succeeds.
- All authentication, rate limiting, CSV, UTM, group, template, and domain validation must finish before the first mutation; any preflight failure creates zero records.
- After preflight, process rows sequentially in CSV order; retain prior successes and continue after later operational failures, including existing within-row partial link/short-link state.
- Audit each successfully created QR, revalidate `/qr` once only when at least one QR was created, and return structured Spanish UI errors.
- A UTM edit authorizes the link through the current organization, updates only `links` UTM columns, audits before/after values, and must not change `qr_codes`, `short_links`, the QR payload/image, or slug.
- Do not add a migration, CSV storage/history, queues, rollback compensation, per-row grouping/design, or request-derived redirect attribution.
- Preserve existing uncommitted work: inspect `git status --short` before each task, modify only the paths listed in that task, and never reset, checkout, or overwrite unrelated changes.

---

## Existing File Map

| Path | Current responsibility | Planned change |
| --- | --- | --- |
| `app/(protected)/qr/bulk/bulk-csv.ts` | Two-column client parser with ready/invalid/excluded rows. | Replace with seven-column, all-or-nothing parser and shared row validation. |
| `app/(protected)/qr/bulk/bulk-csv.test.ts` | Parser tests for the legacy two-column contract. | Replace assertions with the approved CSV contract and edge cases. |
| `app/(protected)/qr/bulk/bulk-qr-import.tsx` | Upload, preview, and direct bulk submit UI. | Convert to the three-step client wizard. |
| `app/(protected)/qr/bulk/page.tsx` | Renders bulk import without organization configuration data. | Load organization-scoped folders, campaigns, templates, and default logo. |
| `app/(protected)/qr/bulk/template/constants.ts` | Legacy two-column downloadable sample. | Publish the exact seven-column template. |
| `app/(protected)/qr/actions.ts` | QR creation actions and the current partial-valid bulk action. | Add preflight-backed batch creation and dynamic-QR UTM update action. |
| `app/(protected)/qr/bulk-actions.test.ts` | Action tests for current sequential bulk creation. | Cover preflight, group/template scope, copied fields, and partial operational failures. |
| `app/(protected)/qr/group-select.tsx` | Optional folder/campaign selector for the single-QR wizard. | Add an opt-in required mode without changing the single-QR default. |
| `app/(protected)/qr/qr-list.tsx` | Dynamic QR edit modal for name and destination. | Display and submit all five persisted UTM values through the new QR action. |
| `app/(protected)/qr/page.tsx` | Maps links to editable QR list rows. | Supply the five UTM values to each dynamic row. |
| `src/modules/links/service.ts` and `index.ts` | Link persistence and request-independent redirect URL construction. | Add organization-scoped persisted-UTM update support and export it. |
| `src/modules/redirects/http.ts` | Redirect handler consuming `buildDestinationUrl`. | Leave implementation unchanged; add redirect contract coverage only if absent. |

### Task 1: Establish the Seven-Column CSV and Wizard-State Contracts

**Files:**
- Create: `app/(protected)/qr/bulk/bulk-wizard-state.ts`
- Create: `app/(protected)/qr/bulk/bulk-wizard-state.test.ts`
- Modify: `app/(protected)/qr/bulk/bulk-csv.ts:1-127`
- Modify: `app/(protected)/qr/bulk/bulk-csv.test.ts:1-83`
- Modify: `app/(protected)/qr/bulk/template/constants.ts:1-7`
- Modify: `app/(protected)/qr/bulk/template/route.test.ts:24-42`

**Interfaces:**
- Consumes: `normalizeUtmValue(value: string): string` from `@/modules/utm`.
- Produces:

```ts
export const BULK_QR_CSV_HEADER = [
  "url", "title", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
] as const;

export type BulkQrUtmValues = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export type BulkQrImportRow = { rowNumber: number; url: string; title: string } & BulkQrUtmValues;
export type BulkQrCsvPreview = { rows: BulkQrImportRow[]; invalidRows: BulkQrInvalidRow[]; fileError?: string };
export function parseBulkQrCsv(csv: string): BulkQrCsvPreview;
export function validateBulkQrRow(row: BulkQrImportRow): string | undefined;
export function validateBulkQrBatchConfiguration(input: { folderId?: string; campaignId?: string; saveAsTemplate: boolean; templateName: string }): string | undefined;
export function canAdvanceBulkQrWizard(input: { preview: BulkQrCsvPreview | null; folderId?: string; campaignId?: string; saveAsTemplate: boolean; templateName: string }): boolean;
```

- [ ] **Step 1: Write failing CSV and state tests**

```ts
it("accepts the exact seven-column header, quoted values, CRLF, and blank lines", () => {
  expect(parseBulkQrCsv(
    "url,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content\r\n" +
    'https://a.example,"Launch, fall", Google , Email , Autumn , "blue, room" , CTA\r\n\r\n',
  )).toMatchObject({
    rows: [{ rowNumber: 1, url: "https://a.example", title: "Launch, fall", utmSource: "google", utmMedium: "email", utmCampaign: "autumn", utmTerm: "blue-room", utmContent: "cta" }],
    invalidRows: [],
  });
});

it("blocks configuration without exactly one shared group", () => {
  expect(canAdvanceBulkQrWizard({ preview: validPreview, folderId: "folder-1", campaignId: "campaign-1", saveAsTemplate: false, templateName: "" })).toBe(false);
  expect(canAdvanceBulkQrWizard({ preview: validPreview, saveAsTemplate: false, templateName: "" })).toBe(false);
});
```

- [ ] **Step 2: Run focused tests to verify RED**

Run: `pnpm test "app/(protected)/qr/bulk/bulk-csv.test.ts" "app/(protected)/qr/bulk/bulk-wizard-state.test.ts"`

Expected: FAIL because the legacy parser exposes `readyRows`/`excludedRows`, does not enforce the exact header or UTM rules, and the wizard-state module does not exist.

- [ ] **Step 3: Implement tokenization, strict parsing, and validation**

```ts
const reservedUtmKeys = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);

export function destinationContainsReservedUtm(url: string): boolean {
  return [...new URL(url).searchParams.keys()].some((key) => reservedUtmKeys.has(key.toLowerCase()));
}

function normalizeOptionalUtm(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? normalizeUtmValue(trimmed) : undefined;
}
```

Parse escaped quotes, LF, and CRLF; report malformed unterminated quoting, a non-exact header, every non-seven-field row, every invalid row, and a file with more than 200 data rows. Preserve one-based CSV row numbers including intervening blank lines. Return no `rows` when `fileError` or `invalidRows` is non-empty so the UI cannot submit a subset.

- [ ] **Step 4: Implement the pure batch-config gate**

```ts
export function validateBulkQrBatchConfiguration({ folderId, campaignId, saveAsTemplate, templateName }: BulkQrBatchConfiguration): string | undefined {
  if (Boolean(folderId) === Boolean(campaignId)) return "Selecciona exactamente una carpeta o campaña para el lote.";
  if (saveAsTemplate && (!templateName.trim() || templateName.trim().length > 255)) return "Ingresa un nombre de plantilla válido.";
}
```

Make `canAdvanceBulkQrWizard` return `false` when the preview has a file error, invalid row, or no rows, or when this configuration validator returns an error.

- [ ] **Step 5: Update the downloadable CSV contract**

```ts
export const BULK_QR_TEMPLATE_CSV =
  "url,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content\r\n" +
  "https://www.example.com,QR example,google,email,fall_launch,,hero\r\n";
```

Keep authenticated download behavior and filename unchanged; update the route test to assert the exact new bytes and headers.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run: `pnpm test "app/(protected)/qr/bulk/bulk-csv.test.ts" "app/(protected)/qr/bulk/bulk-wizard-state.test.ts" "app/(protected)/qr/bulk/template/route.test.ts"`

Expected: PASS; coverage includes exact header casing/order, malformed quoting, quoted/escaped values, CRLF/LF, blank lines, seven fields, 200-row boundary, title/URL/UTM limits, reserved UTM casing, and required-exclusive grouping/template-name gates.

- [ ] **Step 7: Commit the parser contract unit**

```bash
git add "app/(protected)/qr/bulk/bulk-csv.ts" "app/(protected)/qr/bulk/bulk-csv.test.ts" "app/(protected)/qr/bulk/bulk-wizard-state.ts" "app/(protected)/qr/bulk/bulk-wizard-state.test.ts" "app/(protected)/qr/bulk/template/constants.ts" "app/(protected)/qr/bulk/template/route.test.ts"
git commit -m "feat: validate bulk QR CSV configuration"
```

### Task 2: Build the Required Shared-Configuration Wizard

**Files:**
- Modify: `app/(protected)/qr/bulk/page.tsx:1-15`
- Modify: `app/(protected)/qr/bulk/bulk-qr-import.tsx:1-310`
- Modify: `app/(protected)/qr/group-select.tsx:30-190`

**Interfaces:**
- Consumes: `parseBulkQrCsv`, `canAdvanceBulkQrWizard`, `QrDesignFields`, `GroupSelect`, `Folder`, `Campaign`, `QrDesignTemplateRow`, and `CreateBulkWebsiteQrCodesActionInput` from Task 3.
- Produces:

```ts
export type BulkQrImportProps = {
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
};

export function BulkQrImport(props: BulkQrImportProps): JSX.Element;
```

- [ ] **Step 1: Write failing behavior tests for the pure wizard gate before wiring the UI**

```ts
it("does not allow review or create when one CSV row is invalid", () => {
  expect(canAdvanceBulkQrWizard({
    preview: { rows: [], invalidRows: [{ rowNumber: 2, url: "ftp://bad", title: "Bad", error: "..." }] },
    folderId: "folder-1", saveAsTemplate: false, templateName: "",
  })).toBe(false);
});
```

- [ ] **Step 2: Run the gate test to verify RED**

Run: `pnpm test "app/(protected)/qr/bulk/bulk-wizard-state.test.ts"`

Expected: FAIL until Task 1's all-invalid-batch gate is implemented; do not begin UI wiring if this test still permits a partial batch.

- [ ] **Step 3: Load organization-scoped data in the server page**

```tsx
const user = await getCurrentUser();
if (!user) return null;
const organizationId = user.profile.organizationId;
const [folders, campaigns, templates, organization] = await Promise.all([
  listFolders(organizationId), listCampaigns(organizationId), listQrDesignTemplates(organizationId), getOrganization(organizationId),
]);
return <BulkQrImport organizationId={organizationId} folders={folders} campaigns={campaigns} templates={templates} defaultLogoUrl={organization?.defaultLogoUrl ?? undefined} />;
```

- [ ] **Step 4: Implement the three mounted wizard steps**

```tsx
type Step = "csv" | "configuration" | "review";
const [grouping, setGrouping] = useState<{ folderId?: string; campaignId?: string }>({});
const [design, setDesign] = useState<QrDesignFieldsState>(websiteDefaults);

<GroupSelect folders={folders} campaigns={campaigns} value={grouping} onChange={setGrouping} required />
<QrDesignFields organizationId={organizationId} templates={templates} state={design} onChange={(next) => setDesign((current) => ({ ...current, ...next }))} active={step === "configuration"} />
```

Step 1 downloads the exact template, reads the local file only, and shows every CSV error. Step 2 requires exactly one existing folder/campaign and provides the existing shared design/template controls. Step 3 renders count, each destination with UTM-presence indicators, selected group, and the exact design snapshot; disable navigation and create according to `canAdvanceBulkQrWizard` and pending state.

- [ ] **Step 5: Add `required` mode without changing single-QR behavior**

```ts
export function GroupSelect({ folders, campaigns, value, onChange, required = false }: GroupSelectProps) {
  // In required mode omit the "Sin agrupar" item and retain folder/campaign exclusivity.
}
```

Do not alter callers outside bulk import; their omitted prop keeps the existing optional grouping behavior.

- [ ] **Step 6: Wire one full batch payload and duplicate-submit protection**

```ts
startTransition(async () => {
  setSummary(await createBulkWebsiteQrCodesAction({ rows: preview.rows, ...grouping, design, saveAsTemplate, templateName }));
});
```

Do not pass `organizationId` from the client. Keep the current per-row result display for execution failures, but render preflight errors as batch/row Spanish errors and do not show a success result for a rejected batch.

- [ ] **Step 7: Run focused tests and static checks**

Run: `pnpm test "app/(protected)/qr/bulk/bulk-csv.test.ts" "app/(protected)/qr/bulk/bulk-wizard-state.test.ts"`

Expected: PASS; wizard progression is backed by pure tests proving invalid CSV, no group, both groups, and invalid template names block review/create.

Run: `pnpm typecheck`

Expected: PASS; the page supplies the new props and `GroupSelect` remains compatible with all existing callers.

- [ ] **Step 8: Commit the wizard UI unit**

```bash
git add "app/(protected)/qr/bulk/page.tsx" "app/(protected)/qr/bulk/bulk-qr-import.tsx" "app/(protected)/qr/group-select.tsx"
git commit -m "feat: add bulk QR configuration wizard"
```

### Task 3: Add Server-Side Preflight and Sequential Batch Creation

**Files:**
- Modify: `app/(protected)/qr/actions.ts:1-599`
- Modify: `app/(protected)/qr/bulk-actions.test.ts:1-213`

**Interfaces:**
- Consumes: Task 1 CSV validators, `getCurrentUser`, `checkRateLimit`, `listDomains`, `listFolders`, `listCampaigns`, `listQrDesignTemplates`, `createQrDesignTemplate`, `createLink`, `createShortLink`, `createDynamicQrCode`, `recordAudit`, and `revalidatePath`.
- Produces:

```ts
export type CreateBulkWebsiteQrCodesActionInput = {
  rows: BulkQrImportRow[];
  folderId?: string;
  campaignId?: string;
  design: BulkQrDesign;
  saveAsTemplate: boolean;
  templateName?: string;
};
export type BulkQrDesign = Required<Pick<QrCustomization, "backgroundColor" | "foregroundColor" | "errorCorrectionLevel" | "dotsType" | "cornersSquareType" | "cornersDotType">> & Pick<QrCustomization, "logoUrl">;
export async function createBulkWebsiteQrCodesAction(input: CreateBulkWebsiteQrCodesActionInput): Promise<BulkQrImportSummary>;
```

- [ ] **Step 1: Write failing preflight action tests**

```ts
it("creates no records when any submitted row fails server preflight", async () => {
  const result = await createBulkWebsiteQrCodesAction({ ...validInput, rows: [validRow, { ...validRow, rowNumber: 2, url: "https://bad.example/?UTM_Source=x" }] });
  expect(result).toMatchObject({ created: 0, failed: 2 });
  expect(mocks.createLink).not.toHaveBeenCalled();
  expect(mocks.createQrDesignTemplate).not.toHaveBeenCalled();
});

it("rejects a foreign campaign and both grouping IDs before mutations", async () => {
  mocks.listCampaigns.mockResolvedValue([]);
  await expect(createBulkWebsiteQrCodesAction({ ...validInput, folderId: "folder-1", campaignId: "foreign-campaign" })).resolves.toMatchObject({ error: expect.any(String) });
  expect(mocks.createLink).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the action test to verify RED**

Run: `pnpm test "app/(protected)/qr/bulk-actions.test.ts"`

Expected: FAIL because the old positional-row action validates rows independently, has no shared configuration, and can create valid rows beside invalid ones.

- [ ] **Step 3: Define strict input schemas and a preflight result**

```ts
const bulkInputSchema = z.object({
  rows: z.array(bulkQrRowSchema).min(1).max(BULK_QR_MAX_ROWS),
  folderId: z.string().uuid().optional(), campaignId: z.string().uuid().optional(),
  design: customizationSchema,
  saveAsTemplate: z.boolean(), templateName: z.string().optional(),
});

type BulkPreflight = { domain: Domain; group: { folderId?: string; campaignId?: string }; rows: BulkQrImportRow[]; design: BulkQrDesign; templateName?: string };
```

Validate auth, rate limit, complete input shape, unique positive row numbers, all normalized rows, exactly one selected ID, group membership in the current organization, selected template membership if a template ID is accepted, design fields, template-name rules, and the first organization domain. Return Spanish structured batch/row errors before any creation service is called.

- [ ] **Step 4: Implement preflight before the first mutation**

```ts
const preflight = await preflightBulkWebsiteQrCodes(user, parsed.data);
if ("error" in preflight) return preflight.error;

if (preflight.templateName) {
  await createQrDesignTemplate({ organizationId: user.profile.organizationId, name: preflight.templateName, ...preflight.design });
}
```

Template creation follows preflight but precedes row creation. If it throws, return a batch error and start no QR row. Do not add a database transaction or cleanup compensation.

- [ ] **Step 5: Preserve sequential row execution with copied data**

```ts
const link = await createLink({ organizationId, destinationUrl: row.url, ...pickUtm(row) });
const shortLink = await createShortLink({ organizationId, linkId: link.id, domainId: preflight.domain.id });
const qrCode = await createDynamicQrCode({ organizationId, linkId: link.id, shortLinkId: shortLink.id, name: row.title, ...preflight.group, ...preflight.design });
```

Iterate rows in source order, audit only successful QRs, capture each service failure for that row, and continue with remaining rows. Revalidate `/qr` exactly once if `created > 0`. Do not revalidate on a preflight rejection.

- [ ] **Step 6: Extend action assertions and verify GREEN**

```ts
expect(mocks.createLink).toHaveBeenCalledWith(expect.objectContaining({
  destinationUrl: "https://one.example", utmSource: "google", utmTerm: "blue-term", utmContent: "hero",
}));
expect(mocks.createDynamicQrCode).toHaveBeenCalledWith(expect.objectContaining({ folderId: "folder-1", backgroundColor: "#1c1213" }));
expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
```

Run: `pnpm test "app/(protected)/qr/bulk-actions.test.ts"`

Expected: PASS; tests prove authentication/rate-limit/domain checks, zero-mutation preflight failures, exact-one organization group, UTM normalization and reserved-parameter rejection, copied design/group fields, template sequencing, ordered mixed operational results, audits, and one revalidation.

- [ ] **Step 7: Commit the batch action unit**

```bash
git add "app/(protected)/qr/actions.ts" "app/(protected)/qr/bulk-actions.test.ts"
git commit -m "feat: preflight bulk QR creation"
```

### Task 4: Add Authorized Persisted-UTM Updates

**Files:**
- Modify: `src/modules/links/service.ts:22-60`
- Modify: `src/modules/links/index.ts:1-35`
- Create: `src/modules/links/utm.test.ts`
- Modify: `app/(protected)/qr/actions.ts:1-599`
- Create: `app/(protected)/qr/utm-actions.test.ts`

**Interfaces:**
- Consumes: `links`, `getQrCode`, `getLink`, `normalizeUtmValue`, `recordAudit`, and `revalidatePath`.
- Produces:

```ts
export type PersistedUtmValues = { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmTerm?: string; utmContent?: string };
export async function updateLinkUtmValues(input: { organizationId: string; linkId: string; values: PersistedUtmValues }): Promise<Link | undefined>;
export type UpdateDynamicQrUtmFormState = { error?: string; success?: string };
export async function updateDynamicQrUtmAction(_state: UpdateDynamicQrUtmFormState, formData: FormData): Promise<UpdateDynamicQrUtmFormState>;
```

- [ ] **Step 1: Write failing service and action tests**

```ts
it("scopes persisted UTM updates to the organization", async () => {
  await expect(updateLinkUtmValues({ organizationId: "org-1", linkId: "foreign-link", values: { utmSource: "google" } })).resolves.toBeUndefined();
});

it("audits UTM before/after without writing QR or short-link services", async () => {
  await updateDynamicQrUtmAction({}, utmFormData({ qrId: "qr-1", utmSource: " Google " }));
  expect(mocks.updateLinkUtmValues).toHaveBeenCalledWith(expect.objectContaining({ values: { utmSource: "google" } }));
  expect(mocks.updateQrCodeName).not.toHaveBeenCalled();
  expect(mocks.createShortLink).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `pnpm test "src/modules/links/utm.test.ts" "app/(protected)/qr/utm-actions.test.ts"`

Expected: FAIL because no organization-scoped UTM update service or QR UTM action exists.

- [ ] **Step 3: Add the scoped links-module update without changing destination behavior**

```ts
export async function updateLinkUtmValues({ organizationId, linkId, values }: UpdateLinkUtmValuesInput): Promise<Link | undefined> {
  const [link] = await db.update(links).set(values).where(and(eq(links.id, linkId), eq(links.organizationId, organizationId))).returning();
  return link;
}
```

Export this function and type from `src/modules/links/index.ts`. It must not update `destinationUrl`, `shortLinks`, or `qrCodes`.

- [ ] **Step 4: Implement the QR-scoped UTM action**

```ts
const qr = await getQrCode(parsed.data.qrId);
if (!qr || qr.mode !== "dynamic" || !qr.linkId || qr.organizationId !== user.profile.organizationId) return { error: "El código QR no está disponible." };
const before = await getLink(qr.linkId);
if (!before || before.organizationId !== user.profile.organizationId || destinationContainsReservedUtm(before.destinationUrl)) return { error: "La URL de destino no permite etiquetas UTM editables." };
const after = await updateLinkUtmValues({ organizationId: user.profile.organizationId, linkId: qr.linkId, values: normalizedValues });
```

Require auth and rate limit; validate all five optional values with the same trim/length/normalization policy; audit `{ utmSource, utmMedium, utmCampaign, utmTerm, utmContent }` before and after only on success; then revalidate `/qr` and `/links/${qr.linkId}`. Return Spanish validation/authorization errors and make no mutation on failure.

- [ ] **Step 5: Run focused tests to verify GREEN**

Run: `pnpm test "src/modules/links/utm.test.ts" "app/(protected)/qr/utm-actions.test.ts"`

Expected: PASS; tests prove tenant authorization, all-five-field normalization, reserved destination rejection, success-only audit/revalidation, and no QR/short-link write path.

- [ ] **Step 6: Commit the persisted-UTM unit**

```bash
git add "src/modules/links/service.ts" "src/modules/links/index.ts" "src/modules/links/utm.test.ts" "app/(protected)/qr/actions.ts" "app/(protected)/qr/utm-actions.test.ts"
git commit -m "feat: edit dynamic QR UTM values"
```

### Task 5: Expose UTM Editing in the Existing Dynamic QR Modal

**Files:**
- Modify: `app/(protected)/qr/page.tsx:17-103`
- Modify: `app/(protected)/qr/qr-list.tsx:1-537`

**Interfaces:**
- Consumes: `UpdateDynamicQrUtmFormState`, `updateDynamicQrUtmAction`, and the `PersistedUtmValues` fields mapped by the QR page.
- Produces:

```ts
export type QrListRow = { /* existing fields */ utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; utmTerm?: string | null; utmContent?: string | null };
```

- [ ] **Step 1: Write a failing module-level action invocation test**

```ts
it("submits all five persisted UTM inputs from the QR edit form", async () => {
  const data = new FormData();
  data.set("qrId", "qr-1"); data.set("utmTerm", "blue room"); data.set("utmContent", "hero");
  await updateDynamicQrUtmAction({}, data);
  expect(mocks.updateLinkUtmValues).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ utmTerm: "blue-room", utmContent: "hero" }) }));
});
```

- [ ] **Step 2: Run the existing UTM action test to verify RED**

Run: `pnpm test "app/(protected)/qr/utm-actions.test.ts"`

Expected: FAIL until Task 4 exposes the action; this protects the five-field form contract before UI wiring.

- [ ] **Step 3: Map persisted link UTM fields to dynamic QR rows**

```ts
return { ...existingDynamicRow, utmSource: link?.utmSource, utmMedium: link?.utmMedium, utmCampaign: link?.utmCampaign, utmTerm: link?.utmTerm, utmContent: link?.utmContent };
```

- [ ] **Step 4: Add a dedicated UTM submit path to `EditQrModal`**

```tsx
<input type="hidden" name="qrId" value={qrId} />
<input name="utmSource" defaultValue={utmSource ?? ""} />
<input name="utmMedium" defaultValue={utmMedium ?? ""} />
<input name="utmCampaign" defaultValue={utmCampaign ?? ""} />
<input name="utmTerm" defaultValue={utmTerm ?? ""} />
<input name="utmContent" defaultValue={utmContent ?? ""} />
```

Invoke the UTM action after the existing name/destination actions only when its five-field values differ from the values passed to the modal. On success refresh and close; on error keep the modal open. Copy must state that future redirects use the new attribution while the printed QR and short URL remain unchanged.

- [ ] **Step 5: Run focused checks to verify GREEN**

Run: `pnpm test "app/(protected)/qr/utm-actions.test.ts"`

Expected: PASS; the UI payload names match the server schema for all five UTM fields.

Run: `pnpm typecheck`

Expected: PASS; static rows do not require link or UTM data, while dynamic rows pass the optional fields safely.

- [ ] **Step 6: Commit the QR edit surface**

```bash
git add "app/(protected)/qr/page.tsx" "app/(protected)/qr/qr-list.tsx"
git commit -m "feat: expose QR UTM editing"
```

### Task 6: Prove Redirect Invariance and Complete Verification

**Files:**
- Create: `src/modules/links/destination-url.test.ts`
- Modify: `docs/superpowers/plans/2026-09-23-bulk-qr-configuration.md`

**Interfaces:**
- Consumes: `buildDestinationUrl(link: Link): string`, all tests from Tasks 1-5, and the local development application.
- Produces: evidence that persisted UTM edits affect only future redirect destinations and no QR/short-link identifier.

- [ ] **Step 1: Write the failing redirect construction test**

```ts
it("replaces only persisted UTM keys when building a redirect", () => {
  expect(buildDestinationUrl({ ...link, destinationUrl: "https://example.com/p?a=1", utmSource: "google", utmContent: "hero" })).toBe("https://example.com/p?a=1&utm_source=google&utm_content=hero");
});
```

- [ ] **Step 2: Run the redirect test to verify the current contract**

Run: `pnpm test "src/modules/links/destination-url.test.ts"`

Expected: PASS if the existing request-independent redirect builder already appends/replaces persisted UTM fields; otherwise FAIL and fix only `buildDestinationUrl` without accepting request parameters.

- [ ] **Step 3: Run all focused automated coverage**

Run: `pnpm test "app/(protected)/qr/bulk/bulk-csv.test.ts" "app/(protected)/qr/bulk/bulk-wizard-state.test.ts" "app/(protected)/qr/bulk/template/route.test.ts" "app/(protected)/qr/bulk-actions.test.ts" "app/(protected)/qr/utm-actions.test.ts" "src/modules/links/utm.test.ts" "src/modules/links/destination-url.test.ts"`

Expected: PASS; no test permits ready-row-only bulk submission, foreign/ambiguous grouping, preflight mutation, or a QR/short-link write during UTM editing.

- [ ] **Step 4: Run repository quality gates**

Run: `pnpm lint`

Expected: PASS with no server-only module imported by a client component.

Run: `pnpm typecheck`

Expected: PASS with exact action payload and QR/list-row types.

Run: `pnpm test`

Expected: PASS.

Run: `pnpm build`

Expected: PASS; the production build recognizes the bulk page and authenticated template route.

- [ ] **Step 5: Perform a manual browser acceptance pass**

Open `/qr/bulk` as an authenticated user with a domain, folders, campaigns, and templates. Download the template; confirm Spanish errors for wrong header, malformed quoting, an over-limit file, a reserved destination UTM, no group, and both group IDs. Confirm no create control becomes available until all rows and the one shared group are valid. Create a valid batch from a template with a saved-template name; verify every QR has the same design and folder/campaign while each link retains its own UTM fields. Force one later row service failure and confirm earlier successes remain, the following row is attempted, and `/qr` refreshes once. Edit one created QR's UTM values; verify its displayed/printed QR and short URL identifiers remain unchanged and its short URL redirects with the new persisted UTM parameters.

- [ ] **Step 6: Commit verification evidence only after all gates are green**

```bash
git add "src/modules/links/destination-url.test.ts" "docs/superpowers/plans/2026-09-23-bulk-qr-configuration.md"
git commit -m "test: verify bulk QR configuration"
```

## Self-Review

### Spec Coverage

- [x] Three-step dynamic website-only wizard, exact local CSV contract, all-row client blocking, and template download: Tasks 1 and 2.
- [x] Per-row five-field normalized UTM attribution and reserved-parameter precedence: Tasks 1 and 3.
- [x] Exactly one current-organization folder or campaign shared by every QR: Tasks 2 and 3.
- [x] Shared copied design, organization template use, and optional saved template: Tasks 2 and 3.
- [x] Complete preflight with zero mutations plus sequential retained partial-success execution: Task 3.
- [x] Dynamic QR UTM editing with authorization, audit, no QR/short-link changes, and revalidation: Tasks 4 and 5.
- [x] Request-independent redirect behavior after a persisted UTM edit, automated quality gates, and browser verification: Task 6.
- [x] No migration, static-flow change, CSV persistence, queue, rollback, or per-row design/grouping: Global Constraints and all task scopes.

### Placeholder Scan

- [x] Each required validation and error outcome is explicitly named in its owning task.
- [x] Every implementation task identifies exact paths, interface names/types, concrete test sketches, commands, expected outcomes, and a commit boundary.
- [x] Existing user changes are explicitly preserved; no task uses destructive git operations or overwrites unrelated work.

### Type Consistency

- [x] `BulkQrImportRow` owns all five optional camel-case persisted UTM fields from parsing through `createLink`.
- [x] `CreateBulkWebsiteQrCodesActionInput` is the single object payload used by the wizard and action.
- [x] Folder/campaign exclusivity uses optional `folderId` and `campaignId` consistently in client state, preflight, and QR creation.
- [x] `PersistedUtmValues` is shared by the links service and QR UTM action; its field names match the `links` table and `buildDestinationUrl`.
