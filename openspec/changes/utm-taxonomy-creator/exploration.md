## Exploration: Standardized UTM Taxonomy Creator

### Current State
`/settings/utm` already lists and creates organization-scoped `utm_presets`, but its form uses free-text fields and only stores name plus the five standard UTM values and `created_at`. `normalizeUtmValue` currently produces lowercase kebab-case, not snake_case, and normalization is duplicated at action boundaries for Links and QR flows.

Campaign records are separate organizational groupings with free-text names and `active`/`ended` status. The QR wizard already consumes Campaigns and UTM presets. Link creation begins at `/links`, creates a Link, then its detail page creates a Short Link; the website QR wizard creates Link, Short Link, and QR together.

`links.buildDestinationUrl` appends only the five persisted UTM columns; it preserves unrelated query parameters already present in `destination_url`. Thus a generated complete URL can be prefixed into either existing creation flow without changing redirect resolution, but custom parameters are not represented as structured UTM data today.

### Affected Areas
- `app/(protected)/settings/utm/page.tsx` — creator remains at this approved route; must load campaigns and metadata needed by the expanded UI.
- `app/(protected)/settings/utm/utm-presets-form.tsx` — replace free-text taxonomy entry with controlled source/medium, custom-source handling, campaign-prefill selector, warnings, preview, preset management, and creation-flow navigation.
- `app/(protected)/settings/actions.ts` — validate taxonomy, custom parameters, and preset lifecycle metadata under the current authenticated organization.
- `src/modules/utm/{db.ts,service.ts,index.ts}` — evolve the preset model and expose an organization-scoped taxonomy/preset API through the public module boundary.
- `src/lib/utm.ts` and tests — centralize snake_case normalization plus URL construction/parameter validation; current helper emits kebab-case.
- `src/modules/links/{db.ts,service.ts}` — structured custom parameters need persistence and `buildDestinationUrl` support if they must remain editable after creation; otherwise generated URLs may carry them only in `destination_url`.
- `app/(protected)/links/{page.tsx,link-form.tsx}` — accept a validated URL prefill via search parameters; this is the existing first step before Short Link creation.
- `app/(protected)/qr/{page.tsx,create-qr-modal.tsx,website-qr-form.tsx}` — accept a URL prefill and open the website QR path; current modal has no routing/search-param entry point.
- `src/modules/campaigns/index.ts` — the UTM module/UI must consume `listCampaigns` through its public interface only.
- `drizzle/` and `drizzle/meta/` — a generated Drizzle migration is required for preset status, description, creator/update metadata, and any structured custom-parameter persistence.

### Approaches
1. **Creator-first URL handoff with preset metadata** — Keep standard UTM and custom parameters in `utm_presets`; build the preview URL in the UTM module/UI and hand it to `/links` and `/qr` as a URL prefill. Persist custom parameters on a Link only when later editing/redirect composition requires structured ownership.
   - Pros: Smallest blast radius; preserves existing Link/QR creation semantics; custom query parameters already survive in `destination_url`.
   - Cons: Custom parameters are opaque after handoff unless also added to Links; QR handoff needs explicit deep-link/modal state.
   - Effort: Medium.

2. **Shared persisted tracking-parameter model** — Add a JSONB/custom-parameter field to both `utm_presets` and `links`, extend `buildDestinationUrl`, and make every Link/QR create and edit path use one shared tracking payload.
   - Pros: One source of truth; parameters remain editable and auditable after creation; avoids URL-string parsing as the domain model.
   - Cons: Larger migration and every bulk/edit/action path must be changed; needs clear collision rules for existing query parameters and reserved `utm_*` keys.
   - Effort: High.

### Recommendation
Adopt approach 1 for this change, with a pure shared UTM utility that normalizes to snake_case, validates taxonomy/custom keys, emits recommendations and warnings, and deterministically constructs the preview URL. Extend `utm_presets` with description, lifecycle status, `created_by`, `updated_by`, and `updated_at`; treat legacy taxonomy values as displayable historical data but exclude them from the controlled selectors for new/edited presets. Pass the final URL through route search parameters after strict length and `http(s)` validation. Keep custom parameters in the destination URL on handoff unless the proposal explicitly requires post-creation structured editing; that latter requirement should select approach 2.

### Risks
- Changing normalization from kebab-case to snake_case changes all newly written values; existing Link and preset values must not be rewritten implicitly, or analytics dimensions will fragment.
- Existing presets lack creator/update data. The migration needs nullable historical provenance or a documented synthetic/backfill policy; it cannot safely invent a user ID.
- `utm_presets` has no status today. Marking all rows legacy would make existing presets unavailable, while leaving them active may permit legacy values through preset selection; the proposal must define whether “legacy” applies to values, presets, or both.
- Query-string handoff must reject reserved/duplicate keys and cap URL length to prevent accidental overwrite or excessively long destination URLs. Existing QR editing already blocks destinations containing reserved UTM keys.
- The Short Link flow is two-step, not a direct URL-to-short-link page. “Generate Short Link” should prefill `/links` and preserve the normal detail-page Short Link step unless a new direct flow is approved.
- UTM actions currently authorize by authenticated organization and rate-limit some mutations, but Settings UTM mutations do not enforce a role or record audits. Metadata introduces a user foreign key and should align authorization/audit behavior deliberately.
- Drizzle journal is at migration `0015`; migration SQL and snapshot must be generated rather than hand-authored, and RLS must be enabled for any newly introduced table (no new table is needed under the recommendation).

### Ready for Proposal
Yes — with one decision captured in the proposal: custom non-UTM parameters are handoff-only versus structured/editable after Link or QR creation. The recommended handoff-only scope avoids a Link schema migration; metadata and preset lifecycle still require one migration.
