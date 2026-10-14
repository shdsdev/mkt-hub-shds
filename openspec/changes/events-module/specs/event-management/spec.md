# Event Management Specification

## Purpose

Govern the event entity's lifecycle, configuration, and ADMIN-only authorization for creation, editing, and configuration of reminder timing and optional registration-form fields.

## Requirements

### Requirement: ADMIN-Only Event Authoring
The system MUST allow only users with role `ADMIN` to create, edit, publish, or close events. Any other authenticated role MUST be denied.

#### Scenario: ADMIN creates an event
- GIVEN an authenticated user with role `ADMIN`
- WHEN they submit a new event with name, type label, dates, location, and status `draft`
- THEN the system MUST persist the event and allow further edits

#### Scenario: Non-admin attempts event creation
- GIVEN an authenticated user without role `ADMIN`
- WHEN they attempt to create or edit an event
- THEN the system MUST deny the action and persist no change

### Requirement: Event Lifecycle Status
The system MUST model event status as one of `draft`, `published`, `closed`. Only `published` events MUST be reachable on the public landing route.

#### Scenario: Draft event is not publicly reachable
- GIVEN an event with status `draft`
- WHEN an unauthenticated visitor requests its public landing page by slug
- THEN the system MUST NOT render the registration form or event content

#### Scenario: ADMIN publishes an event
- GIVEN an ADMIN has a valid draft event
- WHEN the ADMIN sets its status to `published`
- THEN the public landing page MUST become reachable by slug

### Requirement: Nullable Capacity
The system MUST support a nullable `capacity` field per event. A `null` capacity MUST mean unlimited registrations; a non-null capacity MUST enforce the waitlist behavior defined in `event-public-registration`.

#### Scenario: Unlimited event accepts registrations past any count
- GIVEN an event with `capacity` set to `null`
- WHEN registrations accumulate beyond any threshold
- THEN every new registration MUST be accepted as confirmed, subject only to per-event email uniqueness

### Requirement: Per-Event Reminder Timing Configuration
The system MUST allow an ADMIN to configure exactly one reminder trigger per event, expressed as an offset before the event start with hour-level granularity (not limited to whole days).

#### Scenario: ADMIN sets an hour-level reminder offset
- GIVEN an ADMIN edits an event
- WHEN they set the reminder offset to a non-whole-day value (for example, 36 hours before start)
- THEN the system MUST persist that exact offset for use by the reminder dispatch process

### Requirement: Fixed Optional Field Catalog
The system MUST expose a small, fixed, predefined catalog of optional registration-form fields (for example, company, job title). Per event, an ADMIN MUST be able to toggle which of these fixed fields are collected. The system MUST NOT allow defining new, arbitrary, or free-form fields.

#### Scenario: ADMIN enables an optional field for an event
- GIVEN an ADMIN edits an event's optional-field toggles
- WHEN they enable the "company" field from the fixed catalog
- THEN the public registration form for that event MUST include a company input
- AND no mechanism MUST exist to add a field outside the fixed catalog

#### Scenario: Optional field disabled by default
- GIVEN an event has not had any optional field explicitly toggled on
- WHEN its public registration form is rendered
- THEN none of the fixed catalog's optional fields MUST appear
