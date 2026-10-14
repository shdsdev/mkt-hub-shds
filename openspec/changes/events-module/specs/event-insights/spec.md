# Event Insights Specification

## Purpose

Govern the ADMIN-only registrations admin view and the per-event results dashboard, including search, filtering, and authorized export.

## Requirements

### Requirement: Registrations Admin Search and Filter
The system MUST provide an admin view listing an event's registrations with search and a status filter supporting `confirmed`, `waitlisted`, `cancelled`, and `checked-in`. The view MUST show, per registration: companions, contact info, registration date, acquisition source (UTM), and pass/access status.

#### Scenario: ADMIN filters registrations by status
- GIVEN an event has registrations in multiple statuses
- WHEN an ADMIN filters the registrations admin by `waitlisted`
- THEN only waitlisted registrations MUST be displayed

#### Scenario: ADMIN searches registrations
- GIVEN an event has multiple registrations
- WHEN an ADMIN searches by a registrant's name or email
- THEN only matching registrations MUST be displayed

#### Scenario: Non-admin cannot access registrations admin
- GIVEN an authenticated user without role `ADMIN`
- WHEN they attempt to access the registrations admin view
- THEN the system MUST deny access

### Requirement: Authorized Registration Export
The system MUST allow only an ADMIN to export the registrations list for an event. The export MUST include the same fields visible in the admin view (companions, contact info, registration date, acquisition source, pass/access status).

#### Scenario: ADMIN exports registrations
- GIVEN an ADMIN is viewing an event's registrations admin
- WHEN they request an export
- THEN the system MUST produce a file containing all currently filtered registrations and their visible fields

#### Scenario: Non-admin cannot export
- GIVEN an authenticated user without role `ADMIN`
- WHEN they attempt to trigger the export action directly
- THEN the system MUST deny the action

### Requirement: ADMIN-Only Results Dashboard
The system MUST provide a per-event results dashboard reporting visits, registrations, attendance, and conversion. The system MUST allow only users with role `ADMIN` to view this dashboard.

#### Scenario: ADMIN views the dashboard
- GIVEN an ADMIN opens an event's results dashboard
- WHEN the dashboard loads
- THEN it MUST display visit count, registration count, attendance count, and a conversion metric derived from them

#### Scenario: Non-admin cannot view the dashboard
- GIVEN an authenticated user without role `ADMIN`
- WHEN they attempt to open the event's results dashboard
- THEN the system MUST deny access
