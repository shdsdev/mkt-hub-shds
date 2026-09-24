# Proposal: UTM Taxonomy Creator

## Intent

Provide organization-governed UTM templates at `/settings/utm` and apply them during Link creation and editing without turning the Creator into a URL or Link generator.

## Scope

### In Scope
- Manage templates with five standard UTM values, validated custom non-UTM pairs, metadata, and `active`, `draft`, or `archived` lifecycle.
- Normalize new taxonomy values while preserving legacy records unchanged and excluding legacy values from new-template selectors.
- Keep campaign as editable normalized text, optionally prefilled from an existing Campaign.
- Select current-organization active templates in Link create/edit flows.
- Apply non-empty template parameters to Link destination URLs, replacing matching keys while preserving unrelated query parameters.

### Out of Scope
- Destination entry, final URL previews, or creation of Links, Short URLs, and QR codes in the UTM Creator.
- Creating Short URLs or QR codes when applying a template.
- Rewriting historical taxonomy or inventing historical provenance.

## Capabilities

### New Capabilities
- `utm-template-management`: Organization-scoped template management, validation, lifecycle, metadata, campaign prefilling, and legacy compatibility.
- `link-template-application`: Active-template selection and deterministic destination parameter application in Link creation and editing.

### Modified Capabilities
- None.

## Approach

Evolve `utm_presets` through a generated Drizzle migration for custom parameters, lifecycle, description, and nullable provenance. Centralize normalization and validation in the UTM module. Expose organization-scoped active templates through `src/modules/utm/index.ts`; Link flows consume that API and merge parameters through the Links module. Keep the Creator template-only.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(protected)/settings/utm/`, `settings/actions.ts` | Modified | Template UI and mutations |
| `app/(protected)/links/` | Modified | Create/edit selection and application |
| `src/modules/utm/`, `src/lib/utm.ts` | Modified | Model, API, normalization, validation |
| `src/modules/links/` | Modified | Destination query merging |
| `drizzle/` | Modified | Schema migration and metadata |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Legacy analytics dimensions fragment | Medium | Never rewrite historical values |
| Invalid custom keys override UTM fields | Medium | Reject reserved and duplicate keys server-side |
| Application loses destination data | Medium | Replace only template-owned keys; test preservation |

## Rollback Plan

Remove Link selectors and application while retaining already-saved destinations. Revert Creator, UTM module, and migration changes together; preserve existing preset rows and historical values.

## Dependencies

- Campaign and UTM public module APIs; authenticated organization context.

## Success Criteria

- [ ] Users manage organization-scoped templates across all lifecycle states with validated taxonomy and custom parameters.
- [ ] Link creation and editing offer only active templates from the current organization.
- [ ] Application adds standard and custom parameters, replaces matching keys, and preserves unrelated query parameters.
- [ ] Legacy records remain unchanged and unavailable to new-template taxonomy selectors.
- [ ] The Creator neither requests nor previews destinations and creates no Links, Short URLs, or QR codes.
