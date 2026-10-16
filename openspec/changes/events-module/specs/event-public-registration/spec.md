# Event Public Registration Specification

## Purpose

Govern the public event landing page, the registration form and its companions, acquisition-source capture, per-event email uniqueness, and capacity/waitlist behavior including concurrency-safe promotion.

## Requirements

### Requirement: Public Landing Content Sections
For a `published` event, the system MUST render a public landing page at its own route containing, at minimum, a hero section, an agenda section, a location section, and the registration form. The system MUST NOT render a speakers/ponentes section in this iteration.

#### Scenario: Published event landing renders required sections
- GIVEN a `published` event
- WHEN an unauthenticated visitor requests its landing page by slug
- THEN the page MUST include hero, agenda, location, and registration form sections

### Requirement: Registration With Companions
The system MUST allow a public registrant to register themselves plus zero or more companions in a single submission. Each companion MUST be modeled as a near-independent record with its own name, email, and phone, and MUST receive its own confirmation email, own individual QR pass, and own backup code, distinct from the primary registrant's.

#### Scenario: Registrant submits with two companions
- GIVEN a published event with available capacity
- WHEN a visitor submits the registration form with their own data and two companions' data
- THEN the system MUST create one registration group containing three attendee records (primary + 2 companions)
- AND each of the three attendees MUST receive a separate confirmation email with its own QR pass and own backup code

### Requirement: Per-Event Email Uniqueness
The system MUST NOT allow a registrant email to hold two active (non-cancelled) registrations for the same event. This constraint MUST be enforced at the database level, not only in application code.

#### Scenario: Duplicate registration attempt is rejected
- GIVEN an email already has an active registration for an event
- WHEN a new registration submission uses the same email for the same event
- THEN the system MUST reject the new registration and MUST NOT create a duplicate active record

#### Scenario: Re-registration after cancellation is allowed
- GIVEN an email's prior registration for an event was cancelled
- WHEN that same email submits a new registration for the same event
- THEN the system MUST accept the new registration

### Requirement: Acquisition Source Capture
The system MUST capture UTM parameters present on the landing page URL at the time of registration, using the existing UTM module convention, and MUST persist them on the resulting registration record.

#### Scenario: UTM params present on landing URL
- GIVEN a visitor arrives at the event landing page with UTM query parameters
- WHEN they complete registration
- THEN the resulting registration MUST persist the captured UTM values

#### Scenario: No UTM params present
- GIVEN a visitor arrives without any UTM query parameters
- WHEN they complete registration
- THEN the registration MUST persist with empty/absent acquisition-source fields without failing

### Requirement: Capacity Enforcement and Waitlist Placement
The system MUST enforce a non-null event capacity by counting confirmed registrations. When an event is at or above capacity, new registrations MUST be placed in `WAITLIST` status instead of being rejected.

#### Scenario: Registration at full capacity is waitlisted
- GIVEN an event with capacity reached by confirmed registrations
- WHEN a new registration is submitted
- THEN the system MUST create it with status `WAITLIST` rather than `confirmed`

#### Scenario: Registration below capacity is confirmed
- GIVEN an event with confirmed registrations below its capacity
- WHEN a new registration is submitted
- THEN the system MUST create it with status `confirmed`

### Requirement: Concurrency-Safe Waitlist Promotion
When a confirmed registration is cancelled, the system MUST automatically promote the earliest-waitlisted registration for that event to `confirmed` status and send it the confirmation email and pass. This promotion MUST be performed via a transactional capacity re-check so that concurrent cancellations MUST NOT promote more registrations than capacity allows.

#### Scenario: Cancellation promotes the earliest waitlisted registration
- GIVEN an event at capacity with at least one waitlisted registration
- WHEN a confirmed registration is cancelled
- THEN the system MUST promote the earliest-created waitlisted registration to `confirmed`
- AND MUST send it the confirmation email containing its QR pass and backup code

#### Scenario: Concurrent cancellations do not over-promote
- GIVEN an event at capacity with exactly one waitlisted registration
- WHEN two confirmed registrations are cancelled concurrently
- THEN the system MUST promote at most one waitlisted registration per freed capacity slot
- AND MUST NOT exceed the event's capacity as a result

### Requirement: Manual Admin-Added Registrations
The system MUST allow an ADMIN to add a registration directly from the admin panel, and this registration MUST follow the exact same confirmation-email and QR-pass issuance flow as a public registration. Every registration MUST carry a `source` value of either `public_form` or `admin_added`.

#### Scenario: ADMIN adds a registration manually
- GIVEN an ADMIN is viewing an event's registrations admin
- WHEN they add a registration with attendee details
- THEN the system MUST create it with `source = admin_added`
- AND MUST send the identical confirmation email and QR pass as a public registration would receive

### Requirement: Cancellation and Edit Authorization
The system MUST allow an ADMIN to cancel or edit any registration. The system MUST allow a registrant to self-cancel only, via a signed link delivered in their confirmation email, and MUST NOT allow registrant self-edit.

#### Scenario: ADMIN cancels a registration
- GIVEN an ADMIN views a confirmed registration
- WHEN they cancel it
- THEN the registration status MUST become `cancelled`
- AND waitlist promotion MUST be triggered if applicable

#### Scenario: Registrant self-cancels via signed link
- GIVEN a registrant received a confirmation email containing a signed self-cancel link
- WHEN they follow the link and confirm cancellation
- THEN the system MUST cancel their registration without requiring login

#### Scenario: Registrant cannot self-edit
- GIVEN a registrant holds a confirmation email
- WHEN they attempt to modify their registration details without ADMIN access
- THEN the system MUST provide no such capability
