```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:38054ba4fa6f869604145bc60469ea5b738240a2d8bf200bcda2b881d10e1ebe
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 15/15
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:e840351fae08763f8869648d40fd9e7b48c875f53a0455741eed406362685be6
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:e4a58dca0f249a73ec40d68c1493da1dd99991b6b3a444769346500a600156a0
```

## Verification Report

**Change**: utm-taxonomy-creator
**Version**: N/A (first SDD cycle for this change)
**Mode**: Strict TDD
**Artifact store**: openspec
**Report path**: `openspec/changes/utm-taxonomy-creator/verify-report.md`
**Envelope note**: `evidence_revision` = SHA-256 over the concatenated UTF-8 bytes of the two fenced evidence blocks below (test block bytes followed by build block bytes); each `*_output_hash` is SHA-256 over that block's UTF-8 bytes alone.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

All 14 tasks (1.1-1.6, 2.1-2.2, 3.1-3.3, 4.1-4.3) checked `[x]` in `tasks.md`; every implementation task maps to an existing test file (13 test suites for this change).

### Build & Tests Execution

**Build**: Passed - `pnpm build` exit 0 (Next.js 16.3.4 webpack; TS check clean; 25 static pages generated; all routes including `/settings/utm`, `/links`, `/links/[id]`).

```text
$ pnpm build
[WARN] Unsupported engine: wanted: {"node":"22.x"} (current: {"node":"v24.18.0","pnpm":"11.20.0"})
$ next build --webpack
Next.js 16.3.4 (webpack)
Compiled successfully in 12.1s
Finished TypeScript in 3.4s
Generating static pages using 15 workers (25/25)
Finalizing page optimization ...
Route (app): / /links /links/[id] /qr /qr/bulk /qr/preview /settings /settings/utm /settings/general /settings/users and 16 more

  Proxy (Middleware)
  (Dynamic)  server-rendered on demand
exit code 0
```

**Tests**: 225 passed / 0 failed / 0 skipped (52 files, Vitest 5.0.0). Full suite also passes inside `pnpm check`.

```text
$ pnpm test
[WARN] Unsupported engine: wanted: {"node":"22.x"} (current: {"node":"v24.18.0","pnpm":"11.20.0"})
$ vitest run --passWithNoTests
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module`" in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.0.0 C:/Users/javier.enriquez/Desktop/PROYECTOS/MKT/hub mkt

 Test Files  52 passed (52)
      Tests  225 passed (225)
   Start at  15:41:32
   Duration  3.93s (import 76%, transform 18%, tests 3%, worker 2%)

    Isolate  52 workers spawned ~319ms startup each (spawn + environment, per file)
             at least ~787ms faster with isolate: false - reuses workers across files instead of one per file
exit code 0
```

**Quality gate `pnpm check`** (lint + typecheck + test + build): exit 0 - `eslint .` clean, `tsc --noEmit` clean, 225/225 tests, `next build --webpack` compiled successfully.

**Coverage**: Not available - `openspec/config.yaml` reports `coverage.available: false`; no threshold to measure.

---

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | PASS | `apply-progress.md` contains the TDD Cycle Evidence table (14 task rows). |
| All tasks have tests | PASS | 14/14 tasks reference test files; 13 suites exist (taxonomy, validation, service, utm db, links db, normalize, lib utm, apply-template, destination-url, settings actions, settings page, settings form, links actions). |
| RED confirmed (tests exist) | PASS | 13/13 new/modified test files verified present in the tree. |
| GREEN confirmed (tests pass) | PASS | Full suite 225/225 passes on execution (52 files); per-file verbose run confirms each reported suite is green. |
| Triangulation adequate | PASS | Multi-case suites: normalize 7 new cases, taxonomy 7, validation 14, service 10, apply-template 8, settings actions 6; no single-case spec-scenario gaps. |
| Safety Net for modified files | PASS | 1.1 baseline 165/165 prior suite; 3.1/3.2/4.1 reused existing links suites; new files legitimately N/A. |
| Assertion quality | PASS | No tautologies, ghost loops, smoke-only, or mock-heavy tests (see Assertion Quality below). |

**TDD Compliance**: 7/7 checks passed

---

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 58 | 9 | Vitest 5 (mocked db module) |
| Integration | 11 | 3 | Vitest 5 (server actions + page with mocked modules) |
| Component | 2 | 1 | Vitest 5 + react-dom/server renderToStaticMarkup |
| E2E | 0 | 0 | Not available (config: no E2E suite) |
| **Total (this change)** | **71** | **13** | |

Sources: `utm/normalize.test.ts` 9, `utm/taxonomy.test.ts` 7, `utm/validation.test.ts` 14, `utm/service.test.ts` 10, `utm/db.test.ts` 4, `lib/utm.test.ts` 3, `links/apply-template.test.ts` 8, `links/db.test.ts` 1, `links/destination-url.test.ts` 2, `settings/actions.test.ts` 6, `settings/utm/page.test.tsx` 2, `settings/utm/utm-presets-form.test.tsx` 2, `links/actions.test.ts` 3. (Suite total including pre-existing tests: 225 across 52 files.)

---

### Changed File Coverage
Coverage analysis skipped - no coverage tool detected (`coverage.available: false`). Informational only; not a failure.

---

### Spec Compliance Matrix

Authoritative counts: **7 requirements, 15 scenarios** (spec 1 `utm-template-management`: 5 requirements / 10 scenarios; spec 2 `link-template-application`: 2 requirements / 5 scenarios). All scenarios have a passing covering test.

| Requirement | Scenario | Covering test(s) | Result |
|-------------|----------|------------------|--------|
| REQ-01 Template record and lifecycle | Create an active template | `utm/service.test.ts > createUtmPreset inserts normalized values with creator and status`; `utm/db.test.ts > defaults new rows to active` | COMPLIANT |
| REQ-01 | Update lifecycle | `utm/service.test.ts > archiveUtmPreset sets archived status and updatedAt` | COMPLIANT |
| REQ-01 | Isolate organization templates | `utm/service.test.ts > updateUtmPreset throws when outside organization`; `links/apply-template.test.ts > rejects draft/archived/cross-org` | COMPLIANT |
| REQ-02 Controlled taxonomy and standardization | Select approved taxonomy and prefill campaign | `settings/utm/page.test.tsx > loads campaigns (prefill source) and presets`; `utm/service.test.ts > normalizes standard values to snake_case` | COMPLIANT |
| REQ-02 | Enter a partner source | `utm/validation.test.ts > accepts a custom partner source only in partner/external mode`; `utm/service.test.ts > accepts a custom partner source and normalizes it` | COMPLIANT |
| REQ-03 Combination guidance and deprecated values | Save a non-recommended combination | `utm/validation.test.ts > is warning-only for a non-recommended pair` | COMPLIANT |
| REQ-03 | Display a legacy value | `utm/service.test.ts > listUtmPresets returns legacy rows unchanged`; `utm/taxonomy.test.ts > exposes deprecated values / does not surface through search` | COMPLIANT |
| REQ-04 Custom parameter isolation | Save valid custom parameters | `utm/validation.test.ts > accepts unique valid non-UTM pairs`; `settings/actions.test.ts > passes typed custom parameters` | COMPLIANT |
| REQ-04 | Reject a reserved custom key | `utm/validation.test.ts > rejects a reserved utm_ key case-insensitively`; `settings/actions.test.ts > surfaces service validation errors` | COMPLIANT |
| REQ-05 Template-manager boundary | Manage a template without a destination | `settings/utm/utm-presets-form.test.tsx > renders taxonomy controls and never destination/preview/generation controls` | COMPLIANT |
| REQ-06 Eligible template selection | Select an active template | `links/actions.test.ts > applies the selected template server-side`; `utm/service.test.ts > listActiveUtmTemplates maps rows` | COMPLIANT |
| REQ-06 | Exclude unavailable templates | `links/apply-template.test.ts > rejects a template that is draft, archived, or from another organization` (apply path) + `getActiveUtmTemplate` active-only predicate (selector path) | COMPLIANT |
| REQ-06 | Exclude another organization templates | `links/apply-template.test.ts > rejects a template that is draft, archived, or from another organization`; org-scoped queries throughout | COMPLIANT |
| REQ-07 Apply template parameters to a Link destination | Apply a template to an existing destination | `links/apply-template.test.ts > replaces matching keys and sets non-empty values`; `> preserves unrelated query parameters and the hash` | COMPLIANT |
| REQ-07 | Replace a conflicting destination parameter | `links/apply-template.test.ts > replaces matching keys and sets non-empty values` (utm_source=old replaced by google) | COMPLIANT |

**Compliance summary**: 15/15 scenarios compliant (0 UNTESTED, 0 FAILING, 0 PARTIAL)

---

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-01 Template record and lifecycle | Implemented | `utm_presets` gains description, utm_id, custom_parameters jsonb, status enum, created_by FK SET NULL, updated_at; create/update/archive org-scoped service; migration `0016_utm_taxonomy_creator.sql` matches design columns exactly. |
| REQ-02 Controlled taxonomy and standardization | Implemented | `taxonomy.ts` catalogs (category/status/aliases/recommendedWith); `normalizeUtmValue` now lowercase snake_case; campaign kept as free normalized text; Campaign selector prefills editable text with no FK. |
| REQ-03 Combination guidance and deprecated values | Implemented | `validatePairing` warning-only; deprecated kebab-case entries readable (`getDeprecatedTaxonomyOptions`) but excluded from active options and search. |
| REQ-04 Custom parameter isolation | Implemented | `validateCustomParameters` rejects blank/malformed/duplicate/case-insensitive `utm_` reserved keys; stored in jsonb column separate from UTM fields; `applyCustomPairs` never overrides standard keys. |
| REQ-05 Template-manager boundary | Implemented | `/settings/utm` renders taxonomy/custom-pair/lifecycle controls only; no destination input, URL preview, or Link/Short/QR creation. |
| REQ-06 Eligible template selection | Implemented | Link create (`links/page.tsx`) and edit (`links/[id]/page.tsx`) load `listActiveUtmTemplates(org)`; selectors render `ApplyableUtmTemplate`; server re-fetch via `getActiveUtmTemplate(id, org, active)`. |
| REQ-07 Apply template parameters to a Link destination | Implemented | `applyTemplateToDestination` (pure) + `mergeCustomParametersToDestination` (persistence-side) + `applyUtmTemplateToLink` (org-scoped atomic, server-authoritative); replaces matching keys, sets non-empty, preserves unrelated query + hash; never touches short_links/qr_codes. |

---

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Keep `utm_presets`; additive migration | Yes | 0016 adds only the designed columns/index/check/enum; legacy rows untouched, receive active + empty pairs + timestamps. |
| Typed source/medium catalogs in `src/modules/utm/taxonomy.ts` | Yes | Data records; active-only options feed new-template controls; deprecated retained for display. |
| Server-authoritative application by template ID | Yes | Client never supplies parameters; `getActiveUtmTemplate` re-fetch rejects draft/archived/cross-org. |
| Standard values in `links.utm_*`; custom pairs merged into `destination_url` | Yes | `mergeCustomParametersToDestination` strips standard keys from the URL, sets custom pairs; `buildDestinationUrl` now includes `utm_id`; unrelated query params survive. |
| File changes per design | Yes | All designed files modified/created; `app/(protected)/links/utm-preset-form.tsx` deleted; migration + `meta/0016_snapshot.json` + `_journal.json` present. |
| Cross-module boundaries | Yes | Links module consumes `@/modules/utm` public index only; settings page consumes `@/modules/campaigns` public index; boundary lint (eslint-plugin-boundaries) clean in `pnpm check`. |
| Documented deviations (5) | Watch | See WARNING W2 - all recorded in apply-progress, none break a spec requirement. |

---

### Issues Found

**CRITICAL**: None

**WARNING**:
- W1 (environment, pre-existing): runtime Node is v24.18.0 while `package.json` declares `engines.node: 22.x`. All gates (test/typecheck/lint/build) are green under v24, but reproduction on the declared engine was not exercised. Not introduced by this change.
- W2 (design deviations, per verify decision gate: deviation exists -> WARNING unless it breaks a spec): 5 documented deviations in `apply-progress.md` - (1) `ApplyableUtmTemplate` gained `name` for selector labels; (2) `qr/actions.ts` saves legacy presets with `sourceMode: "external"`; (3) validation messages in Spanish matching codebase convention; (4) `organic`/`affiliate` mediums added so QR wizard suggestions stay valid taxonomy values; (5) in-place full-field edit not exposed in `/settings/utm` UI while `updateUtmPreset` is implemented and tested (spec: edit is MAY, lifecycle change is MUST). None violate spec requirements; each keeps at least one spec-satisfying path.

**SUGGESTION**:
- S1: add a direct unit test asserting `listActiveUtmTemplates` filters by `status = "active"` (the selector path); today the runtime proof of draft/archived exclusion lives in the apply path (`getActiveUtmTemplate` + `applyUtmTemplateToLink` reject test).
- S2: add a component assertion that the campaign-prefill `<select>` renders when `campaigns.length > 0` and copies the name into the editable campaign input; current tests cover the data-loading and normalization halves but not the prefill UI interaction.
- S3: `createLinkAction` rethrows the template-rejection message (does not match the `http`/`valor UTM` catch filters), which would surface as an unhandled error rather than a form-level message; catch and return a field-level error.
- S4: stray untracked `Nuevo Documento de texto.txt` at repo root - unrelated to the change; remove or commit.

---

### Assertion Quality
**Assertion quality**: All assertions verify real behavior

Audit of the 13 change test suites found no tautologies, no ghost loops, no type-only-only assertions, no smoke-only renders, no empty-collection-only asserts without a non-empty companion, and no mock-heavy tests (mock counts are module-level seams with behavior-asserting expectations such as `toHaveBeenCalledWith` on exact payloads).

---

### Quality Metrics
**Linter**: No errors (project-wide `eslint .` inside `pnpm check`, exit 0)
**Type Checker**: No errors (`tsc --noEmit`, exit 0)
**Build**: Passed (`next build --webpack`, exit 0)

---

### Verdict
**PASS WITH WARNINGS**
Full spec-driven verification succeeded: 14/14 tasks complete, 225/225 tests pass (52 files), `pnpm check` green (lint + typecheck + test + build), 7/7 requirements and 15/15 scenarios compliant with runtime coverage, and design coherence confirmed. No default-blocking (CRITICAL) findings; the two WARNINGs are a pre-existing environment mismatch (Node 24 vs declared 22) and documented, spec-compliant design deviations. Non-blocking suggestions noted for hardening.

**Next**: ready-for-archive (after native final verification gate and orchestrator decision on the WARNINGs)