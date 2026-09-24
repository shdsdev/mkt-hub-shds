# Design: UTM Taxonomy Creator

## Technical Approach

Evolve the existing `utm_presets` model and UTM public API into an organization-scoped template manager while retaining the table name for compatibility. `/settings/utm` owns template create/edit/lifecycle operations only. Link create/edit forms receive active template summaries, submit a template ID, and re-fetch the active organization-owned template server-side before applying it. New values use snake_case; persisted legacy values are never rewritten.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Keep `utm_presets`; add lifecycle/metadata columns | Rename/rebuild table | Additive migration preserves IDs and historical taxonomy bytes. |
| Typed source/medium catalogs in `src/modules/utm/taxonomy.ts` | Hard-coded JSX; taxonomy tables | Data records (`category`, `status`, aliases, recommended pairings) are searchable/extensible without coupling options to UI; only active records feed new-template controls. |
| Server-authoritative application by template ID | Trust client-sent parameters | Prevents cross-organization, stale, draft, or archived template application. |
| Store standard values in existing `links.utm_*`; merge custom pairs into `destination_url` | Duplicate all UTM keys in URL | Preserves current redirect/QR behavior while replacing effective matching keys and retaining unrelated query parameters. |

## Data Flow

    /settings/utm form → settings action → @/modules/utm → utm_presets
    Link form + templateId → active org lookup → Links merge/update → links
                                                      ├─ standard → utm_* columns
                                                      └─ custom → destination query

The Links helper removes supplied standard keys from the base URL, persists their replacements in `utm_*`, and uses `URL.searchParams.set` for non-empty custom pairs. `buildDestinationUrl` then produces the effective destination; unrelated parameters survive. No Link, Short Link, or QR mutation is reachable from the settings manager.

## Interfaces / Contracts

```ts
type TemplateStatus = "active" | "draft" | "archived";
type CustomParameter = { key: string; value: string };
type TaxonomyOption = {
  value: string; label: string; category: string;
  status: "active" | "deprecated"; aliases?: string[];
  recommendedWith?: string[];
};
type ApplyableUtmTemplate = {
  id: string; utmSource: string; utmMedium: string; utmCampaign: string;
  utmTerm: string | null; utmContent: string | null; utmId: string | null;
  customParameters: CustomParameter[];
};
```

`utm_presets` adds `description text`, `utm_id text`, `custom_parameters jsonb NOT NULL DEFAULT '[]'`, enum `status NOT NULL DEFAULT 'active'`, nullable `created_by uuid REFERENCES users(id) ON DELETE SET NULL`, and `updated_at timestamptz NOT NULL DEFAULT now()`, plus `(organization_id,status)` index and JSON-array check. `links` adds nullable `utm_id text` so redirects apply that standard key consistently. New writes normalize UTM values with lowercase snake_case. Campaign selection copies a Campaign name into editable text and stores no Campaign FK. Custom source requires mode `partner` or `external`; catalog source/medium membership is validated server-side. Pairing guidance is warning-only. Blank, duplicate, malformed, or case-insensitive `utm_` custom keys are blocking.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/modules/utm/{db,service,index}.ts` | Modify | Schema, org-scoped create/update/list/active lookup contracts. |
| `src/modules/utm/taxonomy.ts`, `validation.ts` | Create | Catalogs, snake_case normalization, warnings, custom-pair validation. |
| `src/lib/utm.ts` | Modify | Change new-value canonicalization from kebab-case to snake_case. |
| `app/(protected)/settings/{actions.ts,utm/page.tsx,utm/utm-presets-form.tsx}` | Modify | Template-only CRUD/lifecycle UI, Campaign prefill, categorized search. |
| `src/modules/links/{db,service,index}.ts` | Modify | Add `utm_id`, pure URL merge, and organization-scoped atomic application. |
| `app/(protected)/links/{page.tsx,link-form.tsx,actions.ts,[id]/page.tsx,[id]/destination-form.tsx}` | Modify | Active selector/apply in create and edit. |
| `app/(protected)/links/utm-preset-form.tsx` | Delete | Remove template management from Links. |
| `drizzle/0016_utm_taxonomy_creator.sql`, `drizzle/meta/{0016_snapshot.json,_journal.json}` | Create/Modify | Generated additive migration metadata. |
| UTM/Links/action/component `*.test.ts(x)` beside affected code | Create/Modify | Strict-TDD coverage. |

## Testing Strategy

RED first: normalization emits snake_case; catalogs exclude deprecated choices and search by category/alias; partner/external custom-source rules; custom-key rejection; warning-only unsupported pairings; legacy rows return unchanged. Service/action tests prove organization isolation, lifecycle filtering, creator/timestamps, editable Campaign prefill, and server re-fetch. Links tests prove standard/custom replacement, empty omission, unrelated query/hash preservation, active-only create/edit application, and no Short Link/QR calls. Component tests assert `/settings/utm` has no destination/generation controls. Run `pnpm test`, then `pnpm check`; no E2E layer exists.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary changes.

## Migration / Rollout

Apply the additive migration before deployment. Existing rows retain exact UTM strings, receive `active` and timestamps, and keep nullable creator/description/ID with empty custom pairs. Rollback application code first; then drop the index/columns/enum only if no new metadata must be retained. Applied Link destinations remain valid and are not reversed.

## Open Questions

None.
