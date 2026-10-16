# Event Attendance Specification

## Purpose

Govern attendee pass issuance (QR + backup code) and authenticated staff check-in, independent of any guest or tokenless access path.

## Requirements

### Requirement: Individual Attendee Passes
The system MUST issue each attendee (primary registrant or companion) their own individual QR pass and their own short alphanumeric backup code, rendered using the `qr` module's pure render functions (`exportQrPng`/`exportQrSvg`). The system MUST NOT create QR-admin-tracked rows for attendee passes.

#### Scenario: Confirmed attendee receives pass artifacts
- GIVEN an attendee's registration becomes `confirmed`
- WHEN their confirmation email is generated
- THEN it MUST include a QR pass image rendered via the `qr` module's pure export functions
- AND it MUST include a distinct short alphanumeric backup code
- AND no row MUST be created in any QR-admin tracking table for this pass

### Requirement: Authenticated Check-In Only
The system MUST require an authenticated, logged-in system user (existing Supabase auth session) to perform check-in. The system MUST NOT provide a guest or tokenless check-in mode.

#### Scenario: Authenticated staff performs check-in
- GIVEN a logged-in system user is on the check-in route
- WHEN they scan a valid attendee QR pass
- THEN the system MUST mark that attendee as checked in and display their confirmation

#### Scenario: Unauthenticated check-in attempt is denied
- GIVEN no active logged-in session
- WHEN a request is made to the check-in route or its underlying action
- THEN the system MUST deny access and perform no check-in

### Requirement: Dedicated Check-In Route
The system MUST resolve check-in on its own dedicated route, distinct from the `/q/[code]` tracking route, so that check-in scans MUST NOT be recorded as generic tracking events.

#### Scenario: Check-in scan does not touch tracking events
- GIVEN an authenticated staff member scans an attendee QR pass on the dedicated check-in route
- WHEN the scan is processed
- THEN the system MUST NOT create or modify any row in the generic tracking-events data used by `/q/[code]`

### Requirement: Backup Code Manual Check-In
The system MUST allow authenticated staff to check an attendee in by manually typing their backup code as an alternative to scanning the QR pass, with equivalent effect.

#### Scenario: Staff checks in via backup code
- GIVEN an authenticated staff member is on the check-in route
- WHEN they type a valid attendee backup code and submit
- THEN the system MUST mark that attendee as checked in identically to a successful QR scan

#### Scenario: Invalid backup code is rejected
- GIVEN an authenticated staff member is on the check-in route
- WHEN they submit a backup code that does not match any attendee for the event
- THEN the system MUST reject it and MUST NOT mark any attendee as checked in

### Requirement: Duplicate Check-In Prevention
The system MUST NOT allow the same attendee to be checked in more than once; a repeat scan or code entry MUST be surfaced as an informational "already checked in" result rather than creating a second attendance record.

#### Scenario: Already checked-in attendee is re-scanned
- GIVEN an attendee was already checked in
- WHEN staff scans their QR pass again
- THEN the system MUST indicate the attendee is already checked in
- AND MUST NOT create a duplicate check-in record
