# QR Design Customization, Templates, 4-Step Wizard, Themed Scrollbar Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Work task-by-task, in order — later tasks depend on earlier schema/service changes compiling first.

**Goal:** Swap the QR renderer from the plain `qrcode` package to `qr-code-styling` (shape-capable), add body/corner-square/corner-dot shape pickers, saved design templates, split the creation wizard's one long form step into three shorter steps (Detalles → Datos → Diseño), and theme the app's scrollbar.

**Architecture:** `qr-code-styling` renders every QR (styled or default) via its `type: "svg"` + `jsdom` Node mode — no `node-canvas` native dependency. PNG downloads/previews rasterize that SVG through `sharp` (already a dependency) instead of `qrcode`'s own PNG path. Logo embedding moves from this project's manual `sharp` composite (removed) into the library's own `imageOptions`. Three new `qr_codes` columns hold the chosen shapes; a new `qr_design_templates` table holds saved designs, copied into the wizard's state on apply (no live link back to the QR). The wizard's screen state grows from `"type" | "form" | "success"` to five screens; `QrWizardShell` (already step-count-agnostic) needs no changes.

**Feasibility already verified this session** (not a plan step — already done in the current tree): `qr-code-styling` + `jsdom` + `sharp` produce a real shaped SVG and a rasterized PNG end-to-end; `qr-code-styling`, `jsdom`, `@types/jsdom` are already installed in `package.json`.

**Design doc:** `docs/superpowers/specs/2026-09-10-qr-design-customization-design.md`

## Global Constraints

- **Never import `@/modules/qr` (or any path under `src/modules/qr/`) from a client (`"use client"`) component.** `service.ts` now pulls in `jsdom` and `sharp` on top of `db`/`postgres` — importing any part of the barrel into client code breaks the browser bundle exactly like the earlier `buildStaticPayload` incident this session (see the `Tooltip`/`static-qr-form.tsx` memory note). Client components that need shape/color values only ever POST them to `/qr/preview` and get an image back — never import rendering code directly.
- Follow ARCHITECTURE.md I-4: only import a module through its `index.ts`.
- The `qr_design_templates.dots_type`/`corners_square_type`/`corners_dot_type` enums reuse the exact same Postgres enums as `qr_codes` (`qr_shape_type`, `qr_corner_type`) — one enum pair, two tables.
- Preserve every pre-existing working-tree change; this plan only touches the files it lists.
- Do not commit until the user explicitly asks.

---

## File Structure

- Modify: `src/modules/qr/db.ts` — new enums (`qrShapeType`, `qrCornerType`), three new `qr_codes` columns, new `qrDesignTemplates` table.
- Modify: `src/modules/qr/service.ts` — rewrite `exportQrPng`/`exportQrSvg` on `qr-code-styling`; widen `QrCustomization`; add `createQrDesignTemplate`/`listQrDesignTemplates`.
- Modify: `src/modules/qr/logo.ts`, `src/modules/qr/logo.test.ts` — drop `computeLogoDimensions`/`LOGO_SAFE_ZONE_RATIO` (image sizing moves to `qr-code-styling`'s `imageOptions`), keep `resolveErrorCorrectionLevel`.
- Modify: `src/modules/qr/index.ts` — export the new service functions/types.
- Modify: `package.json` — remove `qrcode` (and its `@types/qrcode`), already-added `qr-code-styling`/`jsdom`/`@types/jsdom` stay.
- Create: `drizzle/00NN_<generated>.sql` — the new columns/table/enums.
- Create: `public/qr-presets/globe.svg`, `public/qr-presets/scan-me.svg`.
- Modify: `app/(protected)/qr/actions.ts` — widen website/static schemas + actions with shape fields and save-as-template.
- Modify: `app/(protected)/qr/use-qr-preview.ts`, `app/(protected)/qr/preview/route.ts`, `app/(protected)/qr/[id]/download/route.ts` — thread the three shape fields through; drop the SVG+logo restriction in the download route.
- Rewrite: `app/(protected)/qr/qr-shared-fields.tsx` → split into `qr-detail-fields.tsx` (name/grouping/placement) and `qr-design-fields.tsx` (colors/ecLevel/logo/shapes/template picker/save-as-template) — new files, old one deleted.
- Modify: `app/(protected)/qr/website-qr-form.tsx`, `app/(protected)/qr/static-qr-form.tsx` — render across 3 steps instead of 1.
- Modify: `app/(protected)/qr/create-qr-modal.tsx` — 5-screen state machine.
- Modify: `app/(protected)/qr/page.tsx`, `app/(protected)/qr/qr-list.tsx` — thread `listQrDesignTemplates` down.
- Modify: `app/globals.css` — themed scrollbar.
- Modify: `docs/DATABASE.md`.

---

### Task 1: Schema — Shapes on `qr_codes`, New `qr_design_templates` Table

**Files:**
- Modify: `src/modules/qr/db.ts`
- Test: `pnpm typecheck`, `pnpm db:generate`

**Interfaces:**
- Produces: `qrShapeType`, `qrCornerType` pg enums; `qrCodes.dotsType/cornersSquareType/cornersDotType`; new `qrDesignTemplates` table.

- [ ] **Step 1: Add the two shape enums**

```ts
// dotsOptions.type in qr-code-styling excludes 'dot' (singular) — corners include it. Two enums,
// not one, so the type system matches the library's actual constraints.
export const qrShapeType = pgEnum("qr_shape_type", [
  "square",
  "rounded",
  "dots",
  "classy",
  "classy-rounded",
  "extra-rounded",
]);
export const qrCornerType = pgEnum("qr_corner_type", [
  "square",
  "dot",
  "rounded",
  "dots",
  "classy",
  "classy-rounded",
  "extra-rounded",
]);
```

- [ ] **Step 2: Add the three columns to `qrCodes`**

```ts
dotsType: qrShapeType("dots_type").notNull().default("square"),
cornersSquareType: qrCornerType("corners_square_type").notNull().default("square"),
cornersDotType: qrCornerType("corners_dot_type").notNull().default("square"),
```

Place them near `backgroundColor`/`foregroundColor`/`errorCorrectionLevel` — they're the same
"cosmetic/export-time only" group.

- [ ] **Step 3: Add the `qrDesignTemplates` table**

```ts
export const qrDesignTemplates = pgTable("qr_design_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  dotsType: qrShapeType("dots_type").notNull(),
  cornersSquareType: qrCornerType("corners_square_type").notNull(),
  cornersDotType: qrCornerType("corners_dot_type").notNull(),
  backgroundColor: text("background_color").notNull(),
  foregroundColor: text("foreground_color").notNull(),
  errorCorrectionLevel: qrErrorCorrectionLevel("error_correction_level").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Applying a template only ever copies these seven design fields into client state — no FK from
`qr_codes` back to this table (see design doc).

- [ ] **Step 4: Update `qrTables`**

Add `qrShapeType`, `qrCornerType`, `qrDesignTemplates` to the exported `qrTables` const.

- [ ] **Step 5: Typecheck, then generate the migration**

Run: `pnpm typecheck` (expect `0`), then `pnpm db:generate`.

Expected: one new file under `drizzle/` with `CREATE TYPE "qr_shape_type"`, `CREATE TYPE
"qr_corner_type"`, three `ALTER TABLE "qr_codes" ADD COLUMN` (each `NOT NULL DEFAULT 'square'` —
safe as a single statement this time, unlike `name` in the prior migration, because every existing
row gets the same default value, no data-dependent backfill needed), and a `CREATE TABLE
"qr_design_templates"` with its FK to `organizations`.

- [ ] **Step 6: Apply it**

Run: `pnpm db:migrate`. Expected: exits `0`.

- [ ] **Step 7: Update `docs/DATABASE.md`**

Add `qr_shape_type`/`qr_corner_type` to the Enums list; add a bullet under Key Relational
Decisions for the three `qr_codes` columns and the new `qr_design_templates` table (mirroring how
the previous QR-wizard migration's columns are documented there).

- [ ] **Step 8: Do not commit.**

### Task 2: Rendering Engine Swap

**Files:**
- Modify: `src/modules/qr/service.ts`
- Modify: `src/modules/qr/logo.ts`
- Modify: `src/modules/qr/logo.test.ts`
- Modify: `package.json` (remove `qrcode`, `@types/qrcode` if present)
- Test: `pnpm typecheck`, `pnpm test -- logo`

**Interfaces:**
- Consumes: `QRCodeStyling` from `qr-code-styling`, `JSDOM` from `jsdom`, `sharp` (already a
  dependency).
- Produces: `exportQrPng`/`exportQrSvg` keep their existing call signature — `(encodedValue,
  options) => Promise<Buffer>` / `Promise<string>` — only the implementation changes, so
  `/qr/[id]/download`, `/qr/preview`, and `qr-success-panel.tsx` need no changes here (they change
  in Task 5 only to pass the new shape fields through). Widened `QrCustomization` type gains
  `dotsType`/`cornersSquareType`/`cornersDotType`.

- [ ] **Step 1: Widen `QrCustomization`**

```ts
export type QrCustomization = {
  backgroundColor?: string;
  foregroundColor?: string;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  logoUrl?: string;
  dotsType?: "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
  cornersSquareType?: "square" | "dot" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
  cornersDotType?: "square" | "dot" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
};
```

- [ ] **Step 2: Rewrite `exportQrPng`/`exportQrSvg` around one shared builder**

```ts
import { JSDOM } from "jsdom";
import QRCodeStyling from "qr-code-styling";

async function buildQrSvg(encodedValue: string, options: QrCustomization): Promise<Buffer> {
  const hasLogo = Boolean(options.logoUrl);
  const errorCorrectionLevel = resolveErrorCorrectionLevel(options.errorCorrectionLevel ?? "M", hasLogo);

  const qr = new QRCodeStyling({
    width: QR_PIXEL_SIZE,
    height: QR_PIXEL_SIZE,
    type: "svg",
    data: encodedValue,
    // jsdom is required for Node's svg mode — see qr-code-styling's Node.js usage docs.
    jsdom: JSDOM,
    qrOptions: { errorCorrectionLevel },
    dotsOptions: { type: options.dotsType ?? "square", color: options.foregroundColor ?? "#f7eeeb" },
    cornersSquareOptions: {
      type: options.cornersSquareType ?? "square",
      color: options.foregroundColor ?? "#f7eeeb",
    },
    cornersDotOptions: {
      type: options.cornersDotType ?? "square",
      color: options.foregroundColor ?? "#f7eeeb",
    },
    backgroundOptions: { color: options.backgroundColor ?? "#1c130f" },
    ...(hasLogo && {
      image: options.logoUrl,
      imageOptions: { imageSize: LOGO_SAFE_ZONE_RATIO, margin: 4, crossOrigin: "anonymous", saveAsBlob: true },
    }),
  } as ConstructorParameters<typeof QRCodeStyling>[0]);

  const buffer = await qr.getRawData("svg");
  if (!buffer) throw new Error("No se pudo generar el QR.");
  return buffer as Buffer;
}

export async function exportQrPng(encodedValue: string, options: QrCustomization): Promise<Buffer> {
  const svg = await buildQrSvg(encodedValue, options);
  return sharp(svg).png().toBuffer();
}

export async function exportQrSvg(encodedValue: string, options: QrCustomization): Promise<string> {
  const svg = await buildQrSvg(encodedValue, options);
  return svg.toString("utf-8");
}
```

Remove the old `QRCode.toBuffer`/`QRCode.toString` implementation, the `import QRCode from
"qrcode"`, and the manual `sharp` composite block (`computeLogoDimensions`, the second `fetch` +
`sharp(...).composite(...)`) — the library embeds the image itself now. `exportQrSvg` no longer
needs the `Omit<QrCustomization, "logoUrl">` restriction — logos now work in SVG mode too (design
doc's "bonus" callout); it takes the full `QrCustomization`.

- [ ] **Step 3: Trim `logo.ts`**

Delete `LOGO_SAFE_ZONE_RATIO` and `computeLogoDimensions` — image sizing is now
`imageOptions.imageSize` inline in Step 2 (reuse the same `0.22` ratio as a literal there, or keep
`LOGO_SAFE_ZONE_RATIO` exported from `logo.ts` purely as the shared constant both `service.ts` and
its test import, whichever reads cleaner). Keep `resolveErrorCorrectionLevel` and its export
unchanged.

- [ ] **Step 4: Trim `logo.test.ts`**

Remove the `describe("computeLogoDimensions", ...)` block; keep `resolveErrorCorrectionLevel`'s
tests as-is.

- [ ] **Step 5: Remove the old dependency**

Run: `pnpm remove qrcode`. If `@types/qrcode` is a separate devDependency, remove it too — check
`package.json` first (`qrcode` ships its own types in recent versions; only remove `@types/qrcode`
if it's actually listed).

- [ ] **Step 6: Typecheck and run the logo tests**

Run: `pnpm typecheck && pnpm test -- logo`. Expected: both exit `0`.

- [ ] **Step 7: Do not commit.**

### Task 3: Design Templates Service + Public Exports

**Files:**
- Modify: `src/modules/qr/service.ts`
- Modify: `src/modules/qr/index.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Produces: `createQrDesignTemplate(input): Promise<QrDesignTemplateRow>`,
  `listQrDesignTemplates(organizationId): Promise<QrDesignTemplateRow[]>`.

- [ ] **Step 1: Add the service functions**

```ts
export type QrDesignTemplateRow = typeof qrDesignTemplates.$inferSelect;

export async function createQrDesignTemplate(
  input: { organizationId: string; name: string } & Required<
    Pick<QrCustomization, "dotsType" | "cornersSquareType" | "cornersDotType" | "backgroundColor" | "foregroundColor" | "errorCorrectionLevel">
  > &
    Pick<QrCustomization, "logoUrl">,
): Promise<QrDesignTemplateRow> {
  const [template] = await db.insert(qrDesignTemplates).values(input).returning();
  return template;
}

export async function listQrDesignTemplates(organizationId: string): Promise<QrDesignTemplateRow[]> {
  return db.select().from(qrDesignTemplates).where(eq(qrDesignTemplates.organizationId, organizationId));
}
```

- [ ] **Step 2: Export from `index.ts`**

Add `createQrDesignTemplate`, `listQrDesignTemplates`, `type QrDesignTemplateRow` to the export
list.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`. Expected: `0` (new call sites for `createQrDesignTemplate` land in Task 6).

- [ ] **Step 4: Do not commit.**

### Task 4: Preset Logo Assets

**Files:**
- Create: `public/qr-presets/globe.svg`
- Create: `public/qr-presets/scan-me.svg`

- [ ] **Step 1: Author two small SVGs**

`globe.svg` — a simple globe/world icon (circle + meridian/parallel arcs), single color
`currentColor` or a neutral dark fill so it reads against a light QR background. `scan-me.svg` — a
compact "SCAN ME" wordmark, similar sizing (square-ish viewBox, e.g. `0 0 100 100`) so it drops
into `imageOptions.imageSize` consistently regardless of which preset is picked. Keep both under
~2 KB — they're embedded inline in the generated SVG.

- [ ] **Step 2: Do not commit.**

### Task 5: Thread Shape Fields Through Preview/Download Routes

**Files:**
- Modify: `app/(protected)/qr/use-qr-preview.ts`
- Modify: `app/(protected)/qr/preview/route.ts`
- Modify: `app/(protected)/qr/[id]/download/route.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: the widened `QrCustomization` from Task 2.

- [ ] **Step 1: `use-qr-preview.ts`**

Add `dotsType?`, `cornersSquareType?`, `cornersDotType?` to `QrPreviewParams`; add them to the
`useEffect` dependency array alongside the existing color/logo params.

- [ ] **Step 2: `preview/route.ts`**

Add the three fields (each `z.enum([...]).optional()`, matching the two enum value lists from
Task 1) to `previewSchema`; pass them through to `exportQrPng`'s `options`.

- [ ] **Step 3: `[id]/download/route.ts`**

Add the three fields to the `customization` object built from `qr.dotsType`/`qr.cornersSquareType`/
`qr.cornersDotType`. Delete the `if (qr.logoUrl) return ... 400 ...` block guarding SVG export —
SVG-with-logo now works (Task 2's design-doc "bonus").

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [ ] **Step 5: Do not commit.**

### Task 6: Split Shared Fields — Detail Fields vs. Design Fields

**Files:**
- Delete: `app/(protected)/qr/qr-shared-fields.tsx`
- Create: `app/(protected)/qr/qr-detail-fields.tsx`
- Create: `app/(protected)/qr/qr-design-fields.tsx`
- Test: `pnpm typecheck`

**Interfaces:**
- Produces: `<QrDetailFields state={{name, grouping}} onChange={...} organizationId folders
  campaigns />` (placement image moves here too — see below) and `<QrDesignFields
  state={{backgroundColor, foregroundColor, errorCorrectionLevel, logoUrl, dotsType,
  cornersSquareType, cornersDotType}} onChange={...} organizationId templates
  onSaveAsTemplateChange={(save: boolean, name: string) => void} />`.

- [ ] **Step 1: `qr-detail-fields.tsx`**

Carries over `qr-shared-fields.tsx`'s Nombre input, `GroupSelect` + its two hidden inputs, and
`PlacementImageUpload` + its hidden input verbatim (same markup, same hidden-input-carries-value-
into-FormData pattern). Own local state type:

```ts
export type QrDetailFieldsState = { name: string; grouping: { folderId?: string; campaignId?: string }; placementImageUrl?: string };
```

- [ ] **Step 2: `qr-design-fields.tsx`**

Carries over the background/foreground color inputs, the error-correction `Select`, and
`LogoUpload` + its hidden input verbatim. Adds:

- Preset logo row: two buttons ("Usar globo", "Usar 'SCAN ME'") that call the same `onChange`
  logo-url setter as `LogoUpload`'s `onUploaded`, pointing at `/qr-presets/globe.svg` /
  `/qr-presets/scan-me.svg` — plus a small always-visible preview thumbnail of whichever
  `logoUrl` is currently set (upload or preset), so the user can tell what's selected.
- Shape swatches: three `Select`s (`@/components/ui/select`, same as every other dropdown in this
  tree) for Forma del cuerpo (6 `qrShapeType` values), Forma del marco del ojo (7 `qrCornerType`
  values), Forma del ojo (7 `qrCornerType` values) — a visual swatch grid (like the reference
  screenshots) is a nice-to-have, not required for this pass; a labeled `Select` per shape is
  enough and keeps this task from turning into an icon-asset project.
- Template picker: a `Select` populated from the `templates` prop (`QrDesignTemplateRow[]`);
  `onValueChange` finds the template and calls `onChange` with all seven of its design fields at
  once, overwriting current state (matches "Restablecer diseño" semantics — a template is a
  starting point, not a live binding).
- "Guardar como plantilla" checkbox + a name `<input>` that appears only when checked, both as
  plain local `useState` inside this component (not part of the design `state`/`onChange` — the
  action needs `saveAsTemplate`/`templateName` as their own hidden inputs, name them
  `saveAsTemplate` and `templateName` directly on this component's own markup, read by the parent
  form's `FormData` the same way every other field here is).

Own local state type:

```ts
export type QrDesignFieldsState = {
  backgroundColor: string;
  foregroundColor: string;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  logoUrl?: string;
  dotsType: "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
  cornersSquareType: "square" | "dot" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
  cornersDotType: "square" | "dot" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`. Expected: fails only on `website-qr-form.tsx`/`static-qr-form.tsx`/
`create-qr-modal.tsx` still importing the now-deleted `qr-shared-fields.tsx` — expected until
Task 8.

- [ ] **Step 4: Do not commit.**

### Task 7: Actions — Shape Fields + Save-as-Template

**Files:**
- Modify: `app/(protected)/qr/actions.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: `createQrDesignTemplate` from `@/modules/qr`.
- Produces: widened `createWebsiteQrSchema`/`createStaticSchema`; both actions optionally create a
  template row alongside the QR.

- [ ] **Step 1: Add the shape fields to `customizationSchema`**

```ts
const shapeSchema = z.object({
  dotsType: z.enum(["square", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"]),
  cornersSquareType: z.enum(["square", "dot", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"]),
  cornersDotType: z.enum(["square", "dot", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"]),
});
const customizationSchema = z.object({ /* existing fields */ }).merge(shapeSchema);
```

- [ ] **Step 2: Add save-as-template fields**

```ts
const templateSchema = z.object({
  saveAsTemplate: z.enum(["true"]).optional(),
  templateName: z.string().trim().max(255).optional(),
});
```

Merge into both `createWebsiteQrSchema` and `createStaticSchema`.

- [ ] **Step 3: In both actions, after the QR is created, optionally save the template**

```ts
if (parsed.data.saveAsTemplate === "true" && parsed.data.templateName) {
  await createQrDesignTemplate({
    organizationId: user.profile.organizationId,
    name: parsed.data.templateName,
    dotsType: parsed.data.dotsType,
    cornersSquareType: parsed.data.cornersSquareType,
    cornersDotType: parsed.data.cornersDotType,
    backgroundColor: parsed.data.backgroundColor,
    foregroundColor: parsed.data.foregroundColor,
    errorCorrectionLevel: parsed.data.errorCorrectionLevel,
    logoUrl: parsed.data.logoUrl || undefined,
  });
}
```

Placed after the existing `recordAudit` call, before `revalidatePath` — a template-save failure
here shouldn't be surfaced as "the QR wasn't created" (it was); let it throw and surface as a
generic error only if it does, same non-transactional posture the rest of this action already
has.

- [ ] **Step 4: Pass the three shape fields into `createDynamicQrCode`/`createStaticQrCode`**

Both calls already spread most of `parsed.data` field-by-field (from the prior pass) — add
`dotsType: parsed.data.dotsType`, `cornersSquareType: parsed.data.cornersSquareType`,
`cornersDotType: parsed.data.cornersDotType` alongside them.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [ ] **Step 6: Do not commit.**

### Task 8: Wizard — 5 Screens

**Files:**
- Modify: `app/(protected)/qr/create-qr-modal.tsx`
- Modify: `app/(protected)/qr/website-qr-form.tsx`
- Modify: `app/(protected)/qr/static-qr-form.tsx`
- Test: browser checks (Task 11)

**Interfaces:**
- Consumes: `QrDetailFields`/`QrDesignFields` (Task 6), `listQrDesignTemplates` result (threaded
  from `page.tsx` in Task 9).

- [ ] **Step 1: `create-qr-modal.tsx` screen state**

`type Screen = "type" | "detail" | "data" | "design" | "success"`. The type-picker screen
(unchanged) sets `selectedKind` and advances to `"detail"` instead of `"form"`. Add a
`templates: QrDesignTemplateRow[]` prop, threaded down to whichever form is active.

- [ ] **Step 2: Both forms gain 3 render branches instead of 1**

`WebsiteQrForm`/`StaticQrForm` each keep a single `<form action={formAction}>` (all fields across
all three steps stay inside it — the multi-step UI is purely which fields are *visible*, not
separate `<form>` elements, so `FormData` on final submit still has everything) but render through
`QrWizardShell` three times in sequence based on a `step: "detail" | "data" | "design"` prop passed
down from `create-qr-modal.tsx`'s screen state:

```tsx
{step === "detail" && <QrWizardShell step={2} totalSteps={4} title="Detalles" ...>
  <QrDetailFields ... />
  <button type="button" onClick={onNext}>Continuar</button>
</QrWizardShell>}

{step === "data" && <QrWizardShell step={3} totalSteps={4} title="Datos" ...>
  {/* existing kind-specific fields / UTM section, unchanged markup */}
  <button type="button" onClick={onNext}>Continuar</button>
</QrWizardShell>}

{step === "design" && <QrWizardShell step={4} totalSteps={4} title="Diseño" ...>
  <QrDesignFields ... />
  <button type="submit" disabled={pending}>{pending ? <BinaryLoader /> : "Crear código QR"}</button>
</QrWizardShell>}
```

All three branches render inside the *same* `<form>` — fields in a hidden (non-current) step still
exist in the DOM (just not rendered, since only one branch is truthy at a time — actually: since
only one `step` branch renders, the other steps' inputs unmount and their values would be lost on
navigation forward/back unless state lives above the branches). Keep all three field-group states
(`detail`, `dataFields`, `design`) lifted in the form component itself (as already planned in
Tasks 6/8's `useState` shapes) so switching `step` back and forth never loses what was typed —
matches how `fields`/`shared` state already work today, just split three ways instead of one.

`onNext` is `() => setStep(nextStep)`, owned by `create-qr-modal.tsx` and passed down (or local to
each form if simpler — either works since the modal already tracks `screen`, not sub-step;
whichever keeps `create-qr-modal.tsx` from re-rendering the whole modal on every keystroke is
correct — prefer local `step` state inside each form component, with `create-qr-modal.tsx` only
tracking `screen: "detail" | "data" | "design"` as one bucket that both forms enter/exit
identically).

- [ ] **Step 3: `create-qr-modal.tsx`'s "back" wiring**

From `"detail"`, back returns to `"type"` (existing behavior). From `"data"`/`"design"`, back
moves to the previous in-form step (handled inside the form component per Step 2, not by the
modal).

- [ ] **Step 4: Do not commit.**

### Task 9: List Page — Thread Templates

**Files:**
- Modify: `app/(protected)/qr/page.tsx`
- Modify: `app/(protected)/qr/qr-list.tsx`
- Test: `pnpm typecheck`

- [ ] **Step 1: `page.tsx`**

Add `listQrDesignTemplates(orgId)` to the existing `Promise.all`; pass the result to `<QrList>`.

- [ ] **Step 2: `qr-list.tsx`**

Add `templates: QrDesignTemplateRow[]` to `QrList`'s props and thread it into both
`<CreateQrModal>` call sites (empty-state and toolbar), same pattern as `folders`/`campaigns`/
`utmPresets` already are.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`. Expected: `0` — this should be the point the whole feature compiles clean.

- [ ] **Step 4: Do not commit.**

### Task 10: Themed Scrollbar

**Files:**
- Modify: `app/globals.css`
- Test: browser check (Task 11)

- [ ] **Step 1: Add global scrollbar rules**

Near the existing `.ld-binary`/`.t-tt` custom-property-driven additions (same file section style),
add:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--muted-foreground) var(--muted);
}
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
*::-webkit-scrollbar-track {
  background: var(--muted);
}
*::-webkit-scrollbar-thumb {
  background: var(--muted-foreground);
  border-radius: 999px;
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--foreground);
}
```

Token-driven (no new literal colors), so it follows the active theme (dark/midnight) automatically
— matches the project's existing convention (see `HoverMorphIcon`/`BinaryLoader`/`Tooltip`'s own
theme-token usage).

- [ ] **Step 2: Do not commit.**

### Task 11: Browser Verification

**Files:** none

- [ ] **Step 1: `pnpm dev`, open `/qr`, click "Crear código QR"**

Walk one full flow (e.g. "Sitio web"): type → detalles (name+group+placement) → datos (URL+UTM) →
diseño (colors, error correction, a non-default shape for each of the three selectors, a preset
logo). Confirm the live preview updates as shapes/logo change, confirm each step's "Continuar"
doesn't lose data typed in a previous step when going back and forward.

- [ ] **Step 2: Save as template, then apply it**

On that same design step, check "Guardar como plantilla", name it, submit. Start a second QR
creation, reach the design step, pick the saved template from the selector, confirm all seven
fields populate to match what was saved.

- [ ] **Step 3: Confirm the rendered QR reflects the chosen shapes**

Download the created QR (PNG and SVG) from `/qr` and visually confirm the shapes/logo match what
was picked — this is the actual regression risk of the rendering-engine swap, so don't skip it.

- [ ] **Step 4: Confirm SVG+logo download now works**

Create or find a QR with a logo, download SVG format — should succeed (no more 400 error).

- [ ] **Step 5: Confirm the themed scrollbar**

Shrink the browser window or the wizard's step content until a scrollbar appears; confirm it's
colored from the theme, not the browser's native default, in both Signature and Midnight themes.

- [ ] **Step 6: `pnpm build`**

Expected: exits `0`.

- [ ] **Step 7: Clean up any test QR codes/templates created during verification** (archive QRs,
      no delete action exists for templates yet — leaving a test template behind is low-stakes,
      but prefer a recognizably-named one, e.g. "Test — borrar", if one must remain).

---

## Self-Review

### Spec Coverage

- Rendering engine swap, SVG-with-logo bonus: Task 2, Task 5 Step 3.
- Three shape fields end-to-end (schema → service → actions → routes → forms): Tasks 1, 2, 5, 7, 8.
- Saved templates (table, service, save-on-submit, apply-in-wizard): Tasks 1, 3, 6, 7, 8.
- Preset logos: Task 4, consumed in Task 6.
- 4-step wizard (2 → 4, "Detalles"/"Datos"/"Diseño" split): Task 6, Task 8.
- Themed scrollbar, app-wide: Task 10.
- Explicit cuts (frames, gradients, per-corner color, template↔QR linkage): none of the tasks
  above introduce them — confirmed absent by omission, matching the design doc's Out-of-Scope list.

### Incomplete-Step Scan

Task 8 Step 2 names one deliberate implementation judgment call (whether `step` state lives in
`create-qr-modal.tsx` or locally in each form) with an explicit recommendation, not left open —
the only other soft spot in this plan.

### Type Consistency

- `QrCustomization`'s three new optional shape fields (Task 2) must stay in sync with
  `qr_shape_type`/`qr_corner_type`'s enum values (Task 1) and `shapeSchema`'s Zod enums (Task 7) —
  all three lists are written out in full in this plan so a mismatch is easy to spot in review.
- `QrDesignTemplateRow` fields are all `NOT NULL` except `logoUrl` — `createQrDesignTemplate`'s
  input type (Task 3) reflects that with `Required<Pick<...>>` for the six required fields and a
  plain `Pick` for the nullable `logoUrl`.
