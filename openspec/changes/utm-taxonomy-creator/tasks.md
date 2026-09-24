# Tasks: UTM Taxonomy Creator

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,300-1,700 (incl. generated migration meta) |
| Session budget risk (800) | High |
| Suggested split | PR 1 (module) → PR 2 (settings UI) → PR 3 (links) |
| Delivery strategy | ask-on-risk |
| Resolved delivery decision | `size:exception` (maintainer-approved, single PR) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: N/A — resolved as `size:exception` single PR
400-line budget risk: High

Threat matrix: N/A — no tasks.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migration + UTM module API | PR 1 | `pnpm test src/modules/utm src/lib/utm` | `npx drizzle-kit generate` + `pnpm check` | Revert code + drop 0016; preset rows untouched |
| 2 | `/settings/utm` CRUD/lifecycle UI | PR 2 | `pnpm test app/\(protected\)/settings src/modules/utm` | `pnpm dev` → manage template at `/settings/utm` | Revert settings UI/actions; UTM API intact |
| 3 | Links utm_id + apply + selectors | PR 3 | `pnpm test app/\(protected\)/links src/modules/links` | `pnpm dev` → `/links` create/edit, verify URL params | Remove selectors/apply; saved destinations retained |

## Phase 1: Foundation — Migration and UTM Module

- [x] 1.1 RED→GREEN: failing snake_case tests in `src/lib/utm.test.ts`; change `normalizeUtmValue` in `src/lib/utm.ts` from kebab-case to lowercase snake_case
- [x] 1.2 RED→GREEN: `src/modules/utm/taxonomy.ts` catalogs (category, status, aliases, recommendedWith); tests prove deprecated values excluded and category/alias search works
- [x] 1.3 RED→GREEN: `src/modules/utm/validation.ts`; RED tests: blank/duplicate/malformed/`utm_` custom keys rejected, partner-source needs mode partner|external, pairings warning-only
- [x] 1.4 GREEN: generate `drizzle/0016_utm_taxonomy_creator.sql` + meta — utm_presets description, utm_id, custom_parameters jsonb default `[]` + JSON-array check, status enum default active, created_by FK SET NULL, updated_at, `(organization_id,status)` index; `links.utm_id` nullable; RED test: legacy row unchanged with default active/empty pairs
- [x] 1.5 RED→GREEN: `src/modules/utm/{db,service,index}.ts` org-scoped create/update/list/active lookup; tests prove org isolation, lifecycle filtering, creator/timestamps, legacy display
- [x] 1.6 GREEN: Campaign prefill — consume `listCampaigns` via campaigns public index only; editable copied text, no stored FK

## Phase 2: Settings UI — `/settings/utm`

- [x] 2.1 RED→GREEN: `app/(protected)/settings/actions.ts` create/update/archive actions; tests: reserved-key rejection, partner-source, org isolation, prefill intact
- [x] 2.2 RED→GREEN: `utm/page.tsx` + `utm-presets-form.tsx` — categorized searchable selectors, partner mode field, warning preview, lifecycle controls, campaign selector; component tests assert no destination/preview/generation controls

## Phase 3: Links Application

- [x] 3.1 RED→GREEN: pure merge `applyTemplateToDestination` in `src/modules/links/service.ts`; tests: replace matching keys, set non-empty, omit empty, preserve unrelated query/hash, custom never overrides `utm_*`
- [x] 3.2 RED→GREEN: org-scoped atomic apply by template ID (server re-fetch; draft/archived/cross-org rejected); add `utm_id` via `links/db.ts`; export through `index.ts`
- [x] 3.3 RED→GREEN: active selector + apply in `links/{page,link-form,actions,[id]/page,[id]/destination-form}`; delete `utm-preset-form.tsx`; tests assert no Short URL/QR calls

## Phase 4: Verification and Cleanup

- [x] 4.1 Run full `pnpm test`; fix regressions in Links/QR flows
- [x] 4.2 Run `pnpm check` (lint, typecheck, build); fix boundary violations
- [x] 4.3 Remove dead code; confirm Creator never requests or previews destinations
