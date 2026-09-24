# Link Template Application Specification

## Purpose

Allow Link creation and editing flows to apply stored UTM templates to a destination URL.

## Requirements

### Requirement: Eligible template selection

The Link flow MUST offer active templates from the current organization and MUST NOT offer draft or archived templates for application. Selecting a template MUST load its standard UTM fields and custom parameter pairs without changing the stored template.

#### Scenario: Select an active template

- GIVEN the organization has an active UTM template
- WHEN a user selects it in a Link flow
- THEN its stored parameters MUST become available for application

#### Scenario: Exclude unavailable templates

- GIVEN the organization has draft and archived templates
- WHEN a user opens the template selector
- THEN those templates MUST NOT be selectable

#### Scenario: Exclude another organization's templates

- GIVEN another organization has an active template
- WHEN a user opens the current organization's selector
- THEN the other organization's template MUST NOT be available

### Requirement: Apply template parameters to a Link destination

The Link flow MUST apply non-empty standard UTM values and custom parameter pairs to the Link destination URL. Template keys MUST replace destination query values with the same keys while unrelated destination query parameters remain unchanged; custom pairs MUST NOT override standard UTM keys. Applying a template MUST NOT create a Short URL or QR code.

#### Scenario: Apply a template to an existing destination

- GIVEN a destination URL has unrelated query parameters and a selected active template
- WHEN the user applies the template
- THEN template parameters MUST be present and unrelated parameters MUST remain

#### Scenario: Replace a conflicting destination parameter

- GIVEN the destination URL contains `utm_source` and the template supplies another source
- WHEN the user applies the template
- THEN the template source MUST replace the destination value
