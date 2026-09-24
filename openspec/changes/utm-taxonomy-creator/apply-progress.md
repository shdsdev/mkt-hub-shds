# Apply Progress: UTM Taxonomy Creator

## Summary

Implemented the complete `utm-taxonomy-creator` change as a single PR under a maintainer-approved
`size:exception`. `/settings/utm` now manages reusable UTM templates (controlled taxonomy, custom
partner/external source, custom non-UTM pairs, lifecycle, creator/timestamps) with no destination
or link/short/QR generation. Link create/edit select only active org-scoped templates and apply
them server-side, preserving unrelated query parameters. `normalizeUtmValue` now emits lowercase
snake_case; legacy rows are never rewritten.

**Mode**: Strict TDD. **Test runner**: `pnpm vitest run` / `pnpm test`.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/lib/utm.test.ts`, `src/modules/utm/normalize.test.ts` | Unit | ✅ 165/165 baseline | ✅ Written | ✅ Passed | ✅ 7 cases | ➖ None needed |
| 1.2 | `src/modules/utm/taxonomy.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 7 cases | ✅ Clean |
| 1.3 | `src/modules/utm/validation.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 14 cases | ✅ Clean |
| 1.4 | `src/modules/utm/db.test.ts`, `src/modules/links/db.test.ts` | Unit (schema) | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases | ➖ None needed |
| 1.5 | `src/modules/utm/service.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 10 cases | ✅ Clean |
| 1.6 | `app/(protected)/settings/utm/page.test.tsx` | Integration (page) | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 2.1 | `app/(protected)/settings/actions.test.ts` | Integration (action) | N/A (new) | ✅ Written | ✅ Passed | ✅ 6 cases | ➖ None needed |
| 2.2 | `app/(protected)/settings/utm/utm-presets-form.test.tsx` | Component | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 3.1 | `src/modules/links/apply-template.test.ts` | Unit | ✅ existing links tests | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Clean |
| 3.2 | `src/modules/links/apply-template.test.ts`, `src/modules/links/destination-url.test.ts` | Unit | ✅ existing | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 3.3 | `app/(protected)/links/actions.test.ts` | Integration (action) | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |
| 4.1 | full suite | All | ✅ | — | ✅ 225/225 | — | ✅ QR/links regressions fixed |

### Test Summary

- **Total tests written (this change)**: 58 new assertions/tests across 13 new test files + 2
  modified suites.
- **Total tests passing**: 225 (full suite, 52 files).
- **Layers used**: Unit (taxonomy, validation, service, schema, pure merge), Integration (page +
  server-action mocks), Component (renderToStaticMarkup).
- **Approval tests** (refactoring): `normalizeUtmValue` behavior-change (kebab→snake) — updated
  existing approval tests to the new contract.
- **Pure functions created**: `normalizeTemplateValues`, `validateSourceValue`,
  `validateMediumValue`, `validatePairing`, `validateCustomParameters`,
  `getActiveTaxonomyOptions`, `searchTaxonomyOptions`, `applyTemplateToDestination`,
  `mergeCustomParametersToDestination`, `getRecommendedMediumsForSource`.

## Work Unit Evidence

| Unit | Focused test command + result | Runtime harness + result | Rollback boundary |
|------|-------------------------------|--------------------------|-------------------|
| 1 — Migration + UTM module | `pnpm vitest run src/modules/utm src/lib/utm.test.ts src/modules/links/db.test.ts` → 61 passed | `npx drizzle-kit generate --name utm_taxonomy_creator` → `0016_utm_taxonomy_creator.sql`; `pnpm typecheck` → clean | Revert `src/modules/utm/*`, `src/lib/utm.ts`, drop `0016`; preset rows untouched |
| 2 — `/settings/utm` UI | `pnpm vitest run "app/(protected)/settings"` → 16 passed | `pnpm build` → compiled `/settings/utm` route | Revert settings UI/actions; UTM API intact |
| 3 — Links apply + selectors | `pnpm vitest run "app/(protected)/links" src/modules/links` → 28 passed | `pnpm build` → compiled `/links` + `/links/[id]` | Remove selectors/apply; saved destinations retained |
| Full | `pnpm test` → 225 passed | `pnpm lint` clean, `pnpm typecheck` clean, `pnpm build` success | — |

## Deviations from Design

1. `ApplyableUtmTemplate` gained a `name` field (the design contract listed only id + UTM values)
   so the Link selectors can render a human label.
2. `qr/actions.ts` (out of the design's File Changes list) gained a one-line `sourceMode:
   "external"` on its legacy `createUtmPreset` "save as preset" call, so the QR wizard's free-text
   source remains valid under the new taxonomy validation.
3. `normalizeUtmValue` error strings and validation messages are Spanish to match the existing
   codebase convention.
4. Added `organic`/`affiliate` as active mediums so the QR wizard's existing medium suggestions
   remain valid taxonomy values.
5. In-place full-field template editing is not exposed in the `/settings/utm` UI; `updateUtmPreset`
   is implemented and tested, while the UI exposes the MUST lifecycle control (archive) plus create.
   (Spec: edit is MAY, lifecycle change is MUST.)

## Blocker / Issues

None.
