# QR Creation Wizard, New Static Types, and QR Grouping Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Work task-by-task, in order — later tasks depend on earlier schema/service changes compiling first.

**Goal:** Replace the 2-screen "Sitio web / Texto fijo" QR creation modal with a multi-step wizard (visually based on the installed `onboarding-screen` shadcn component) offering six content types — Sitio web, Texto fijo, vCard, Correo electrónico, SMS, WiFi — each requiring a name, with optional UTM tagging (Sitio web only), an optional placement photo, and optional folder-or-campaign grouping; plus an org-level default logo in Settings.

**Architecture:** `qr_codes` gains `name` (NOT NULL, backfilled), `static_kind` (descriptive enum, doesn't touch the existing dynamic/static CHECK), `placement_image_url`, `folder_id`, `campaign_id`. The four new content types are not a new `qr_mode` — they're `static_payload` strings built server-side by a new `buildStaticPayload` function in `modules/qr`, reusing the existing static-QR code path end to end. `createWebsiteQrCodeAction` and a new unified `createStaticQrCodeAction` (replacing the old single-kind one) both accept the shared fields (name, folder/campaign, placement image); the website action additionally threads UTM params through the already-UTM-aware `createLink()`. The modal becomes a `QrWizardShell` (adapted from the installed component) driving a type step and a form step.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript 5 strict, Tailwind CSS 4, Drizzle ORM, Supabase Storage, `@base-ui/react` Select/Dialog (already migrated in this tree), Zod, Vitest.

**Design doc:** `docs/superpowers/specs/2026-09-10-qr-creation-wizard-design.md`

## Global Constraints

- Follow `ARCHITECTURE.md` I-4: other modules only import from a module's `index.ts`, never `db.ts`/`service.ts` directly. Every new service function must be re-exported from `src/modules/qr/index.ts` (and `src/modules/users/index.ts` for the default-logo function) before other files use it.
- `qr_codes.campaign_id` referencing `campaigns.id` creates a **circular Drizzle-schema import** (`campaigns/db.ts` already imports `qrCodes` from `qr/db.ts` for `print_runs.qr_code_id`; `qr/db.ts` would now import `campaigns` from `campaigns/db.ts`). Drizzle's `.references(() => table.column)` closure form is designed to tolerate this (the callback isn't invoked until the whole schema module graph has finished evaluating), but this is the first time this codebase has a two-way circular reference between schema files — verify it explicitly (Task 2, Step 4) rather than assuming it works.
- Use the already-installed `@/components/ui/select` (Base UI Select) for every new dropdown — do not add native `<select>` elements; the rest of this tree has already migrated away from them.
- Static QR content stays "untrackable and uneditable" (DATABASE.md) — no edit action for any static kind's fields after creation, this plan doesn't add one.
- Preserve every pre-existing working-tree change (loaders, tooltips, Select migration, analytics work) — this plan only touches the files it lists.
- Do not commit until the user explicitly asks, per session convention.

---

## File Structure

- Modify: `src/modules/qr/db.ts` — add `name`, `static_kind` enum + column, `placement_image_url`, `folder_id`, `campaign_id`.
- Modify: `src/modules/users/db.ts` — add `organizations.default_logo_url`.
- Create: `drizzle/00NN_<generated>.sql` — generated migration, hand-edited to add the `qr-placement-images` storage bucket + policies and the `name` backfill `UPDATE`.
- Modify: `src/modules/qr/service.ts` — `createDynamicQrCode`/`createStaticQrCode` accept the new fields; new `buildStaticPayload`.
- Create: `src/modules/qr/static-payload.ts` — pure vCard/mailto/sms/WIFI string builders.
- Create: `src/modules/qr/static-payload.test.ts` — Vitest coverage for the builders (escaping, optional fields).
- Modify: `src/modules/qr/index.ts` — export `buildStaticPayload` and its input types.
- Modify: `src/modules/users/service.ts` — new `updateDefaultLogo`.
- Modify: `src/modules/users/index.ts` — export `updateDefaultLogo`, `getOrganization` (already exported).
- Modify: `app/(protected)/qr/actions.ts` — extend the website schema/action (name, folder/campaign, placement image, UTM); replace the static schema/action with a `kind`-discriminated union covering all five static kinds.
- Create: `app/(protected)/qr/placement-image-upload.tsx` — adapted from `logo-upload.tsx`.
- Run (installs, not authored): `pnpm dlx shadcn@latest add https://registry.watermelon.sh/r/onboarding-screen.json` → `src/components/onboarding-screen.tsx`.
- Create: `app/(protected)/qr/qr-wizard-shell.tsx` — rewritten from the installed file; not a general-purpose primitive, stays QR-local.
- Create: `app/(protected)/qr/group-select.tsx` — the shared folder-or-campaign `Select`.
- Modify: `app/(protected)/qr/create-qr-modal.tsx` — six-card type step + wizard shell wiring.
- Modify: `app/(protected)/qr/website-qr-form.tsx` — shared fields + UTM section.
- Rewrite as: `app/(protected)/qr/static-qr-form.tsx` — one component taking a `kind` prop, rendering kind-specific fields + shared fields.
- Modify: `app/(protected)/qr/qr-list.tsx`, `app/(protected)/qr/page.tsx` — `name` as heading, static-kind icon, folder/campaign subtitle.
- Modify: `app/(protected)/settings/page.tsx`, `app/(protected)/settings/actions.ts` — default-logo section + action.
- Modify: `docs/DATABASE.md` — document the five new columns and the storage bucket.

---

### Task 1: Install the Wizard Shell Source Component

**Files:**
- Create (by the CLI): `src/components/onboarding-screen.tsx`
- Modify (by the CLI): `package.json`, `pnpm-lock.yaml` (adds `motion`, `react-icons`)
- Test: none — inspected, not yet wired into the app

**Interfaces:**
- Produces: the raw reference source at `src/components/onboarding-screen.tsx`, read (not imported) by Task 8.

- [x] **Step 1: Confirm the target path is absent**

Run: `Test-Path "src/components/onboarding-screen.tsx"`

Expected: `False`.

- [x] **Step 2: Install**

Run: `pnpm dlx shadcn@latest add https://registry.watermelon.sh/r/onboarding-screen.json`

Expected: creates `src/components/onboarding-screen.tsx`; adds `motion` and `react-icons` to `package.json` dependencies.

- [x] **Step 3: Confirm the install didn't touch anything else**

Run: `git status --short`

Expected: only `package.json`, `pnpm-lock.yaml`, and the new `src/components/onboarding-screen.tsx` are new/modified by this step (on top of whatever was already dirty in the tree before this task).

- [x] **Step 4: Do not commit.**

### Task 2: Schema — `qr_codes` and `organizations`

**Files:**
- Modify: `src/modules/qr/db.ts`
- Modify: `src/modules/users/db.ts`
- Test: `pnpm typecheck` (schema files compile, circular import resolves), `pnpm db:generate` (SQL is emitted correctly)

**Interfaces:**
- Consumes: `folders` from `@/modules/links/db` (already imported in `qr/db.ts` is not — add it), `campaigns` from `@/modules/campaigns/db` (new import — see Global Constraints circularity note).
- Produces: `qrCodes.name/staticKind/placementImageUrl/folderId/campaignId`, `organizations.defaultLogoUrl`, new `qrStaticKind` pg enum.

- [x] **Step 1: Add the new enum and columns to `qr_codes`**

In `src/modules/qr/db.ts`, add the import and enum:

```ts
import { folders } from "@/modules/links/db";
import { campaigns } from "@/modules/campaigns/db";

export const qrStaticKind = pgEnum("qr_static_kind", ["text", "vcard", "email", "sms", "wifi"]);
```

Add to the `qrCodes` column set (after `id`/`organizationId`, before `mode` is fine, or grouped with the other descriptive fields — keep it readable):

```ts
name: text("name").notNull(),
staticKind: qrStaticKind("static_kind"),
placementImageUrl: text("placement_image_url"),
folderId: uuid("folder_id").references(() => folders.id),
campaignId: uuid("campaign_id").references(() => campaigns.id),
```

Update `qrTables` to include `qrStaticKind`.

- [x] **Step 2: Add the default-logo column to `organizations`**

In `src/modules/users/db.ts`, add to the `organizations` table:

```ts
defaultLogoUrl: text("default_logo_url"),
```

- [x] **Step 3: Typecheck before generating — this is where the circular import either resolves or fails**

Run: `pnpm typecheck`

Expected: exits `0`. If it fails on the `campaigns`/`qrCodes` circular import, fall back to declaring `campaignId` as a plain `uuid("campaign_id")` column with no `.references()` (drop the FK constraint, keep the column) and note this deviation in the migration's SQL comment — don't spend more than one troubleshooting pass on it.

- [x] **Step 4: Generate the migration and inspect it**

Run: `pnpm db:generate`

Expected: one new file under `drizzle/`, containing `CREATE TYPE "public"."qr_static_kind"`, five `ALTER TABLE "qr_codes" ADD COLUMN` statements (`name` initially nullable — drizzle-kit can't know about the backfill, that's added by hand next), one `ALTER TABLE "organizations" ADD COLUMN "default_logo_url"`, and the two new FK constraints (or one, if Step 3 fell back).

- [x] **Step 5: Hand-edit the generated migration to add the `name` backfill and `NOT NULL`, plus the storage bucket**

Following the exact precedent in `drizzle/0004_slippery_morlocks.sql` (the `qr-logos` bucket), append to the generated file, after the `name` column is added but before anything else references it:

```sql
UPDATE "qr_codes" SET "name" = COALESCE(NULLIF("static_payload", ''), 'QR sin nombre') WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "qr_codes" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
```

If drizzle-kit already emitted `name` as `NOT NULL` in one statement (unlikely without data awareness, but verify), split it into: add nullable → backfill → set not null, in that order.

Then append the storage bucket, mirroring `0004_slippery_morlocks.sql` exactly (same policy shapes, new bucket id):

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qr-placement-images', 'qr-placement-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "qr_placement_images_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qr-placement-images');
--> statement-breakpoint
CREATE POLICY "qr_placement_images_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'qr-placement-images');
--> statement-breakpoint
CREATE POLICY "qr_placement_images_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'qr-placement-images' AND owner = auth.uid());
```

(5 MB limit instead of the logo bucket's 2 MB — placement photos are real photographs, not small embedded logos.)

- [x] **Step 6: Apply the migration**

Run: `pnpm db:migrate`

Expected: exits `0`; no error about existing rows violating the new `NOT NULL` (the backfill runs first).

- [x] **Step 7: Update `docs/DATABASE.md`**

Add the five `qr_codes` columns, the `organizations.default_logo_url` column, the `qr_static_kind` enum, and the `qr-placement-images` bucket to the relevant sections, matching how the existing `qr-logos` bucket and `qr_error_correction_level` enum are documented there.

- [x] **Step 8: Do not commit.**

### Task 3: Static Payload Builders

**Files:**
- Create: `src/modules/qr/static-payload.ts`
- Create: `src/modules/qr/static-payload.test.ts`
- Modify: `src/modules/qr/index.ts`
- Test: `pnpm test -- static-payload`

**Interfaces:**
- Produces: `buildStaticPayload(input: StaticPayloadInput): string`, a discriminated union on `kind`.

- [x] **Step 1: Write the builder**

```ts
export type StaticPayloadInput =
  | { kind: "text"; content: string }
  | { kind: "vcard"; fullName: string; phone: string; email: string; company?: string; website?: string }
  | { kind: "email"; address: string; subject?: string; body?: string }
  | { kind: "sms"; number: string; message?: string }
  | { kind: "wifi"; ssid: string; password: string; security: "WPA" | "WEP" | "nopass"; hidden: boolean };

function escapeVCard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function escapeWifi(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/"/g, '\\"');
}

export function buildStaticPayload(input: StaticPayloadInput): string {
  switch (input.kind) {
    case "text":
      return input.content;
    case "vcard": {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${escapeVCard(input.fullName)}`,
        `TEL:${escapeVCard(input.phone)}`,
        `EMAIL:${escapeVCard(input.email)}`,
      ];
      if (input.company) lines.push(`ORG:${escapeVCard(input.company)}`);
      if (input.website) lines.push(`URL:${escapeVCard(input.website)}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    case "email": {
      const params = new URLSearchParams();
      if (input.subject) params.set("subject", input.subject);
      if (input.body) params.set("body", input.body);
      const query = params.toString();
      return `mailto:${input.address}${query ? `?${query}` : ""}`;
    }
    case "sms": {
      const params = new URLSearchParams();
      if (input.message) params.set("body", input.message);
      const query = params.toString();
      return `sms:${input.number}${query ? `?${query}` : ""}`;
    }
    case "wifi":
      return `WIFI:T:${input.security};S:${escapeWifi(input.ssid)};P:${escapeWifi(input.password)};H:${input.hidden};;`;
  }
}
```

- [x] **Step 2: Write the test file**

Cover, matching the existing `logo.test.ts` style (`describe`/`it`, no mocking needed — pure functions):
- `text` returns the content verbatim.
- `vcard` with all fields, and again with `company`/`website` omitted (lines absent, not empty).
- `vcard` escapes a comma/semicolon/backslash in `fullName`.
- `email` with and without `subject`/`body` (no trailing `?` when both omitted).
- `sms` with and without `message`.
- `wifi` for each `security` value, `hidden: true` and `false`, and escaping a `;`/`,`/`"` in `ssid`/`password`.

- [x] **Step 3: Export from the module's public surface**

In `src/modules/qr/index.ts`, add `buildStaticPayload` and `type StaticPayloadInput` to the export list.

- [x] **Step 4: Run the new tests**

Run: `pnpm test -- static-payload`

Expected: all pass.

- [x] **Step 5: Do not commit.**

### Task 4: Service Layer — `createStaticQrCode`, `createDynamicQrCode`, Default Logo

**Files:**
- Modify: `src/modules/qr/service.ts`
- Modify: `src/modules/qr/index.ts`
- Modify: `src/modules/users/service.ts`
- Modify: `src/modules/users/index.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: the new `qr_codes`/`organizations` columns from Task 2.
- Produces: `createDynamicQrCode`/`createStaticQrCode` accepting `name`, `folderId?`, `campaignId?`, `placementImageUrl?` (both), and `staticKind` (static only); new `updateDefaultLogo(organizationId, url): Promise<void>`.

- [x] **Step 1: Extend `QrCustomization`-adjacent input types in `service.ts`**

```ts
export type QrGrouping = {
  name: string;
  folderId?: string;
  campaignId?: string;
  placementImageUrl?: string;
};
```

Update `createDynamicQrCode`'s input to `{ organizationId: string; linkId: string; shortLinkId: string } & QrCustomization & QrGrouping`.

Update `createStaticQrCode`'s input to `{ organizationId: string; payload: string; staticKind: "text" | "vcard" | "email" | "sms" | "wifi" } & QrCustomization & QrGrouping`, and pass `staticKind` through in the `.values()` call (it currently spreads `rest` — confirm `staticKind` lands in the insert since it's part of the same object, not a column with a different name needing a rename).

- [x] **Step 2: Export the new type**

Add `type QrGrouping` to `src/modules/qr/index.ts`'s export list.

- [x] **Step 3: Add `updateDefaultLogo` to `src/modules/users/service.ts`**

```ts
export async function updateDefaultLogo(organizationId: string, url: string | null): Promise<void> {
  await db.update(organizations).set({ defaultLogoUrl: url }).where(eq(organizations.id, organizationId));
}
```

- [x] **Step 4: Export it**

Add `updateDefaultLogo` to `src/modules/users/index.ts`.

- [x] **Step 5: Typecheck**

Run: `pnpm typecheck`

Expected: exits `0`. Fix any call sites broken by the widened `createStaticQrCode`/`createDynamicQrCode` signatures now (there are two call sites today, both in `app/(protected)/qr/actions.ts`, rewritten in Task 6 anyway — a transient type error here is expected and resolved by that task, not a bug to chase now).

- [x] **Step 6: Do not commit.**

### Task 5: Placement Image Upload Component

**Files:**
- Create: `app/(protected)/qr/placement-image-upload.tsx`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (same as `logo-upload.tsx`).
- Produces: `<PlacementImageUpload organizationId={string} onUploaded={(url: string | undefined) => void} />`.

- [x] **Step 1: Copy `logo-upload.tsx`'s structure, retargeted**

Same shape as `app/(protected)/qr/logo-upload.tsx`: `useState<"idle" | "uploading" | "error">`, direct-to-Storage upload, `BinaryLoader` while uploading (this project's established loading-state convention — see `docs/ARCHITECTURE.md` "Loading states"). Differences: bucket `"qr-placement-images"` instead of `"qr-logos"`; label "Foto de ubicación (opcional) — dónde se usará este QR: flyer, revista, catálogo…"; accepts the same image MIME types.

- [x] **Step 2: Typecheck**

Run: `pnpm typecheck`

Expected: exits `0`.

- [x] **Step 3: Do not commit.**

### Task 6: Rewrite `actions.ts` — Website (UTM + shared fields) and Unified Static Action

**Files:**
- Modify: `app/(protected)/qr/actions.ts`
- Test: `pnpm typecheck`, browser form submission checks (Task 10)

**Interfaces:**
- Consumes: `buildStaticPayload`, `type StaticPayloadInput` from `@/modules/qr`; `createLink` (already accepts `utmSource`/`utmMedium`/`utmCampaign`, per `app/(protected)/links/actions.ts`'s existing usage); `normalizeUtmValue` (same helper `links/actions.ts` uses — confirm its import path and reuse it, don't duplicate).
- Produces: extended `createWebsiteQrCodeAction`; a single `createStaticQrCodeAction` replacing the old one, handling all five static kinds.

- [x] **Step 1: Add the shared fields schema**

```ts
const groupingSchema = z.object({
  name: z.string().trim().min(1).max(255),
  folderId: z.string().uuid().optional().or(z.literal("")),
  campaignId: z.string().uuid().optional().or(z.literal("")),
  placementImageUrl: z.string().url().optional().or(z.literal("")),
});
```

- [x] **Step 2: Extend the website schema and action with grouping + UTM**

```ts
const createWebsiteQrSchema = z
  .object({
    destinationUrl: z.string().trim().min(1).max(2048),
    utmSource: z.string().trim().max(255).optional(),
    utmMedium: z.string().trim().max(255).optional(),
    utmCampaign: z.string().trim().max(255).optional(),
  })
  .merge(customizationSchema)
  .merge(groupingSchema);
```

In `createWebsiteQrCodeAction`, read the three new UTM fields and `name`/`folderId`/`campaignId`/`placementImageUrl` from `formData` the same way the existing fields are read; pass the (optionally `normalizeUtmValue`-normalized) UTM values into the existing `createLink()` call exactly as `app/(protected)/links/actions.ts`'s `createLinkAction` does; pass `name`, `folderId || undefined`, `campaignId || undefined`, `placementImageUrl || undefined` into `createDynamicQrCode`.

- [x] **Step 3: Replace the static schema/action with a kind-discriminated union**

```ts
const staticKindFieldsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), content: z.string().trim().min(1).max(2048) }),
  z.object({
    kind: z.literal("vcard"),
    fullName: z.string().trim().min(1).max(255),
    phone: z.string().trim().min(1).max(50),
    email: z.string().trim().email(),
    company: z.string().trim().max(255).optional(),
    website: z.string().trim().url().max(2048).optional(),
  }),
  z.object({
    kind: z.literal("email"),
    address: z.string().trim().email(),
    subject: z.string().trim().max(255).optional(),
    body: z.string().trim().max(2000).optional(),
  }),
  z.object({
    kind: z.literal("sms"),
    number: z.string().trim().min(1).max(30),
    message: z.string().trim().max(500).optional(),
  }),
  z.object({
    kind: z.literal("wifi"),
    ssid: z.string().trim().min(1).max(64),
    password: z.string().trim().max(128),
    security: z.enum(["WPA", "WEP", "nopass"]),
    hidden: z.coerce.boolean().default(false),
  }),
]);

const createStaticSchema = staticKindFieldsSchema
  .and(customizationSchema)
  .and(groupingSchema);

export type CreateStaticQrFormState = { error?: string; qrCodeId?: string };

export async function createStaticQrCodeAction(
  _prevState: CreateStaticQrFormState,
  formData: FormData,
): Promise<CreateStaticQrFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return { error: RATE_LIMIT_ERROR };

  const kind = formData.get("kind");
  const raw: Record<string, unknown> = { kind, name: formData.get("name") };
  for (const key of ["content", "fullName", "phone", "email", "company", "website", "address", "subject", "body", "number", "message", "ssid", "password", "security", "hidden", "backgroundColor", "foregroundColor", "errorCorrectionLevel", "logoUrl", "folderId", "campaignId", "placementImageUrl"]) {
    const value = formData.get(key);
    if (value !== null) raw[key] = value;
  }

  const parsed = createStaticSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revisa los campos del formulario." };

  const { name, folderId, campaignId, placementImageUrl, backgroundColor, foregroundColor, errorCorrectionLevel, logoUrl, ...kindFields } = parsed.data;
  const payload = buildStaticPayload(kindFields as StaticPayloadInput);

  const qrCode = await createStaticQrCode({
    organizationId: user.profile.organizationId,
    payload,
    staticKind: parsed.data.kind,
    name,
    folderId: folderId || undefined,
    campaignId: campaignId || undefined,
    placementImageUrl: placementImageUrl || undefined,
    backgroundColor,
    foregroundColor,
    errorCorrectionLevel,
    logoUrl: logoUrl || undefined,
  });

  await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "create", resourceType: "qr_code", resourceId: qrCode.id, after: qrCode });
  revalidatePath("/qr");
  return { qrCodeId: qrCode.id };
}
```

(Exact destructure/field-collection code above is a starting point — adjust for whatever TypeScript actually infers from the `.and()`-combined schema; the `raw` object hand-assembly step exists because `formData.get()` returns `null` for absent fields and the discriminated union needs `undefined`, not `null`, for optional fields to validate correctly.)

- [x] **Step 4: Typecheck**

Run: `pnpm typecheck`

Expected: exits `0`.

- [x] **Step 5: Do not commit.**

### Task 7: Group Select (Folder or Campaign)

**Files:**
- Create: `app/(protected)/qr/group-select.tsx`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: `Select`/`SelectTrigger`/`SelectContent`/`SelectGroup`/`SelectItem`/`SelectValue` from `@/components/ui/select`; `type Folder` from `@/modules/links`; `type Campaign` from `@/modules/campaigns`.
- Produces: `<GroupSelect folders={Folder[]} campaigns={Campaign[]} onChange={(value: { folderId?: string; campaignId?: string }) => void} />`.

- [x] **Step 1: Implement**

A single `Select` with two `SelectGroup`s ("Carpetas", "Campañas") plus a leading ungrouped `SelectItem value="none"` ("Sin agrupar"). Item values are prefixed (`folder:<id>` / `campaign:<id>`) to disambiguate in one flat value space; `onValueChange` parses the prefix and calls `onChange({ folderId: id })`, `onChange({ campaignId: id })`, or `onChange({})` for `"none"`.

- [x] **Step 2: Typecheck**

Run: `pnpm typecheck`

Expected: exits `0`.

- [x] **Step 3: Do not commit.**

### Task 8: `QrWizardShell`

**Files:**
- Create: `app/(protected)/qr/qr-wizard-shell.tsx`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: `motion` from `motion/react`, structure/visual patterns read from `src/components/onboarding-screen.tsx` (Task 1) — not imported, rewritten.
- Produces: `<QrWizardShell step={1 | 2} totalSteps={2} title={string} subtitle={string} onBack={() => void} preview={ReactNode}>{children}</QrWizardShell>`.

- [x] **Step 1: Rewrite the installed component into a generic 2-step shell**

Keep: the rounded-card container, the spring-animated progress bar (`motion.div` width transition, same spring config as the source), the back-chevron button, the split left-content/right-panel layout. Drop: all "Business/Workspace" copy, the hardcoded `businessName`/`legalName` fields, the 3-step assumption, `react-icons`' `HiBadgeCheck` (not used here — QR wizard's right panel is the live QR preview, passed in via the `preview` prop, not a static illustration).

Use this project's existing color tokens (`bg-card`, `border-border`, `text-foreground`, etc.) instead of the source's hardcoded `bg-white`/`dark:bg-[#0A0A0A]` — the source component assumes a light/dark toggle this app's `data-app-theme` system doesn't use.

- [x] **Step 2: Typecheck**

Run: `pnpm typecheck`

Expected: exits `0`.

- [x] **Step 3: Do not commit.**

### Task 9: Rewrite the Type Step and Both Forms

**Files:**
- Modify: `app/(protected)/qr/create-qr-modal.tsx`
- Modify: `app/(protected)/qr/website-qr-form.tsx`
- Rewrite: `app/(protected)/qr/static-qr-form.tsx`
- Test: browser checks (Task 10)

**Interfaces:**
- Consumes: `QrWizardShell` (Task 8), `GroupSelect` (Task 7), `PlacementImageUpload` (Task 5), `createStaticQrCodeAction`/`createWebsiteQrCodeAction` (Task 6), `listFolders`/`listCampaigns` (passed down from `page.tsx`, Task 11).
- Produces: the full 2-step wizard UI.

- [x] **Step 1: Six-card type step in `create-qr-modal.tsx`**

Replace the 2-card grid with six cards: Sitio web, Texto fijo, vCard ("Compartir datos de contacto"), Correo electrónico ("Recibir mensajes por correo"), SMS ("Recibir mensajes de texto"), WiFi ("Conexión a una red WiFi") — copy matches the reference screenshot the user provided. Each card sets `selectedKind` and advances `screen` to `"form"`. `screen` state narrows to `"type" | "form" | "success"`.

- [x] **Step 2: `website-qr-form.tsx` — shared fields + UTM**

Add, ahead of the existing `destinationUrl` field: Nombre (required input), `GroupSelect`, `PlacementImageUpload`. Add a "Agregar etiquetas UTM" checkbox that reveals a section matching `app/(protected)/links/link-form.tsx`'s UTM block (preset `Select` calling the same kind of `applyPreset` pattern, then source/medium/campaign inputs) — read `utmPresets` from a new prop threaded down from `create-qr-modal.tsx` → `page.tsx` (`listUtmPresets`, already exported from `modules/utm`). Add the inline note: "Tu QR usará un enlace corto automáticamente."

- [x] **Step 3: Rewrite `static-qr-form.tsx` to take a `kind` prop**

`StaticQrForm({ kind, organizationId, onCreated })`. Shared fields (Nombre, `GroupSelect`, `PlacementImageUpload`, color/logo/ecLevel) render once; a `switch (kind)` block renders the kind-specific inputs:
- `text`: unchanged `contenido` field.
- `vcard`: nombre completo, teléfono, email, empresa (optional), sitio web (optional).
- `email`: dirección, asunto (optional), cuerpo (optional).
- `sms`: número, mensaje (optional).
- `wifi`: SSID, contraseña, seguridad (`Select`: WPA/WEP/Ninguna), oculta (checkbox).

A hidden `<input type="hidden" name="kind" value={kind} />` carries the discriminant to `createStaticQrCodeAction`. The live preview (`useQrPreview`) needs a payload string to show something before submit — compute a local preview string with the same logic as `buildStaticPayload` (client-side approximation is fine for the preview only; the canonical payload is still built server-side in the action, per the design doc) or, simpler, skip the live-preview payload for non-text kinds and show a static "la vista previa aparece después de crear el QR" note — decide based on how much the preview is actually used today (check `use-qr-preview.ts`'s cost/latency before duplicating the builder logic client-side).

- [x] **Step 4: Wire `QrWizardShell` into both forms' rendering**

Both forms render inside `<QrWizardShell step={2} totalSteps={2} title={...} subtitle={...} onBack={() => setScreen("type")} preview={<the existing preview <img> block>}>` — the two-column `grid grid-cols-2` layout each form used standalone moves into the shell (form fields as `children`, preview as the `preview` prop).

- [x] **Step 5: Do not commit.**

### Task 10: Browser Verification of the Wizard

**Files:** none (verification only)

- [x] **Step 1: `pnpm dev`, open `/qr`, click "Crear código QR"**

Confirm all six type cards render with the right copy/icons.

- [x] **Step 2: Walk each of the six flows to completion**

For Sitio web, Texto fijo, vCard, Correo electrónico, SMS, WiFi: fill the shared fields (name required — try submitting without it, confirm a validation error, not a silent failure), fill kind-specific fields, submit, confirm the success panel and a real row appears in `/qr` afterward with the right name/type icon.

- [x] **Step 3: UTM on Sitio web**

Toggle "Agregar etiquetas UTM", pick a preset, confirm it populates source/medium/campaign; submit; confirm (via `/links/[id]` on the created link, or a DB check) the UTM values landed on the link.

- [x] **Step 4: Grouping**

Create one QR into an existing folder and one into an existing campaign; confirm the `/qr` list shows the group name in the subtitle for both.

- [x] **Step 5: Placement image**

Upload a placement photo on one QR; confirm it's stored and (wherever it's surfaced — at minimum, confirm no upload error) retrievable.

- [x] **Step 6: `pnpm build`**

Expected: exits `0` — this feature touches enough surface area (schema, six form paths, a new shared component) that a production build catch is worth it before calling this done.

### Task 11: List Page — Name as Heading, Group Subtitle, Kind Icons

**Files:**
- Modify: `app/(protected)/qr/page.tsx`
- Modify: `app/(protected)/qr/qr-list.tsx`
- Test: browser check (part of Task 10, re-verify after this task)

**Interfaces:**
- Consumes: `listFolders`, `listCampaigns` (fetched once in `page.tsx`, passed to `QrList` for the group-name lookup and, via `create-qr-modal.tsx`, into the wizard's `GroupSelect`).
- Produces: `QrListRow` gains `name: string`, `staticKind?: "text" | "vcard" | "email" | "sms" | "wifi"`, `groupName?: string`.

- [x] **Step 1: `page.tsx` — fetch folders/campaigns, build `groupName`**

Fetch `listFolders(orgId)` and `listCampaigns(orgId)` alongside the existing `Promise.all`; build lookup maps; for each row, set `groupName` from `folderId`/`campaignId` if either is set.

- [x] **Step 2: `qr-list.tsx` — `QrHeading` shows `name`**

`QrHeading` renders `row.name` as the title; the existing destination-URL/payload line moves to a secondary line (already secondary-styled — just swap which value is the `font-mono font-medium` title-line content). Add `row.groupName` to the existing metadata row (next to type/date/status) when present. Add a `STATIC_KIND_ICON` map (lucide `IdCard`/`Mail`/`MessageSquare`/`Wifi`/`FileText`) for the static-type badge, replacing the generic static icon for the four new kinds.

- [x] **Step 3: Browser re-check**

Reload `/qr`; confirm names show as titles, group names show when set, and kind icons are correct for each of the six types.

- [x] **Step 4: Do not commit.**

### Task 12: Settings — Default Logo

**Files:**
- Modify: `app/(protected)/settings/page.tsx`
- Modify: `app/(protected)/settings/actions.ts`
- Test: browser check

**Interfaces:**
- Consumes: `getOrganization`, `updateDefaultLogo` from `@/modules/users`.
- Produces: a "Logotipo" section on `/configuracion`, an `updateDefaultLogoAction`.

- [x] **Step 1: `settings/page.tsx`**

Fetch `getOrganization(user.profile.organizationId)`. Add a "Logotipo" section (after "Temas") using the same upload pattern as `PlacementImageUpload`/`LogoUpload` — a client sub-component that uploads to the existing `qr-logos` bucket (this is a logo, same bucket makes sense — not the new placement-image bucket) and calls `updateDefaultLogoAction` with the resulting URL. Show the current `defaultLogoUrl` as a thumbnail when set.

- [x] **Step 2: `settings/actions.ts`**

```ts
export async function updateDefaultLogoAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const url = formData.get("logoUrl");
  await updateDefaultLogo(user.profile.organizationId, typeof url === "string" && url ? url : null);
  revalidatePath("/configuracion");
}
```

- [x] **Step 3: Thread the default logo into the wizard**

`create-qr-modal.tsx` receives `defaultLogoUrl` as a prop from `page.tsx` (`getOrganization`), passes it into both `WebsiteQrForm`/`StaticQrForm` as the initial `logoUrl` state value (still replaceable per QR via the existing `LogoUpload`).

- [x] **Step 4: Browser check**

Set a default logo in Settings; open the QR wizard; confirm the logo step is pre-filled; confirm it's still replaceable.

- [x] **Step 5: Do not commit.**

---

## Self-Review

### Spec Coverage

- Mandatory `name`, backfilled for existing rows: Task 2.
- Six content types, five of them sharing the static path via a discriminated payload builder: Tasks 3, 6, 9.
- UTM on Sitio web only, reusing `modules/utm`: Task 6, Step 2; Task 9, Step 2.
- Folder-or-campaign grouping on any QR type (not just dynamic, via new `qr_codes` columns instead of the `links`-only mechanism): Tasks 2, 7, 9, 11.
- Placement image: Tasks 2, 5, 9.
- Org-level default logo, pre-filled into the wizard: Task 12.
- `onboarding-screen` installed and adapted (not used as-is): Tasks 1, 8.
- List page reflects name/group/kind: Task 11.

### Incomplete-Step Scan

Task 9 Step 3 (client-side preview for non-text static kinds) and Task 2 Step 3 (circular-import fallback) are the two places this plan asks the implementer to make a small judgment call rather than prescribing one exact answer — both are explicitly flagged as such, with a stated fallback, not left silently ambiguous.

### Type Consistency

- `createStaticQrCode`'s widened input (`QrGrouping` intersected with the existing `QrCustomization`) is introduced in Task 4 before Task 6 consumes it — compiles in dependency order.
- `StaticPayloadInput`'s discriminated union (Task 3) and `createStaticSchema`'s Zod discriminated union (Task 6) must stay in sync on the `kind` literal values (`text | vcard | email | sms | wifi`) and field names — both lists are written out in full in this plan to make a mismatch easy to spot in review.
- `qr_codes.staticKind` is nullable (dynamic rows), but every `createStaticQrCode` call always supplies one — the type only allows `undefined` on the dynamic path, not the static one.
