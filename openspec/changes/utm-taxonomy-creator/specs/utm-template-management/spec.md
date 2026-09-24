# UTM Template Management Specification

## Purpose

Provide organization-scoped reusable UTM templates without URL or link generation.

## Requirements

### Requirement: Template record and lifecycle

The system MUST store each template with name, description, source, medium, campaign, content, term, `utm_id`, custom parameter pairs, lifecycle state, creator, and creation/update metadata. It MUST support `active`, `draft`, and `archived` states; users MAY edit a template and change its state.

#### Scenario: Create an active template

- GIVEN an authorized organization user enters valid template values
- WHEN the user saves an active template
- THEN the organization receives a template with all submitted fields and creation metadata

#### Scenario: Update lifecycle

- GIVEN a saved template exists in the organization
- WHEN an authorized user archives it
- THEN its lifecycle state and update metadata MUST change

#### Scenario: Isolate organization templates

- GIVEN another organization has a template
- WHEN a user manages templates in the current organization
- THEN the other organization's template MUST NOT be available

### Requirement: Controlled taxonomy and standardization

The system MUST allow new source and medium values only from their active controlled taxonomies, except that an authorized user MAY add a custom partner source. New UTM values MUST be normalized to canonical lowercase snake_case; campaign MUST remain free normalized text rather than a controlled selector. An existing Campaign selector MAY prefill campaign text, which MUST remain editable and independent of that Campaign record.

#### Scenario: Select approved taxonomy and prefill campaign

- GIVEN active source and medium values and an existing Campaign are available
- WHEN a user selects them for a new template
- THEN stored values MUST be normalized and campaign text MAY be edited before saving

#### Scenario: Enter a partner source

- GIVEN a user needs a source absent from the controlled taxonomy
- WHEN the user adds a valid partner source with spaces or hyphens
- THEN it MUST be stored as a normalized snake_case source

### Requirement: Combination guidance and deprecated values

The system MUST warn when a selected source/medium pair is not recommended, but MUST NOT block a valid save solely for that warning. Historical or deprecated taxonomy values MUST remain readable unchanged on existing templates and MUST NOT be selectable or suggested for new templates.

#### Scenario: Save a non-recommended combination

- GIVEN a valid source and medium form a non-recommended pair
- WHEN the user saves the template after seeing the warning
- THEN the template MUST be saved

#### Scenario: Display a legacy value

- GIVEN a historical template contains a deprecated kebab-case value
- WHEN a user views it
- THEN the original value MUST be visible but unavailable to new-template selectors

### Requirement: Custom parameter isolation

The system MUST keep custom non-UTM parameter pairs separate from standard UTM fields. It MUST reject blank, invalid, duplicate, or reserved `utm_` keys and MUST NOT let custom pairs replace standard UTM values.

#### Scenario: Save valid custom parameters

- GIVEN a template has unique valid non-UTM parameter pairs
- WHEN the user saves it
- THEN the pairs MUST be retained separately from its UTM fields

#### Scenario: Reject a reserved custom key

- GIVEN a user adds `utm_source` as a custom parameter key
- WHEN the user attempts to save
- THEN the system MUST reject the template and identify the invalid key

### Requirement: Template-manager boundary

The `/settings/utm` manager MUST NOT request a destination URL, preview a final URL, or create Links, Short URLs, or QR codes.

#### Scenario: Manage a template without a destination

- GIVEN a user opens `/settings/utm`
- WHEN the user creates or edits a template
- THEN no destination or generated-link control MUST be presented
