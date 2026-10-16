# Notifications Email Specification

## Purpose

Govern transactional email delivery for events (confirmation, reminder, waitlist promotion) over Resend, the webhook-driven reminder trigger required by the Vercel Hobby plan, and the notification log that guarantees idempotent, auditable sends.

## Requirements

### Requirement: Confirmation Email Content
The system MUST send a confirmation email to each attendee (primary and each companion individually) upon their registration reaching `confirmed` status. The email MUST contain that attendee's individual QR pass image and their own short alphanumeric backup code.

#### Scenario: Confirmed attendee receives confirmation email
- GIVEN an attendee's registration status becomes `confirmed`
- WHEN the confirmation is triggered
- THEN the system MUST send an email to that attendee containing their individual QR pass image and backup code

### Requirement: Waitlist Promotion Email
The system MUST send a confirmation email, identical in content to the standard confirmation email, to an attendee whose registration is automatically promoted from `WAITLIST` to `confirmed`.

#### Scenario: Promoted attendee receives confirmation
- GIVEN a waitlisted attendee's registration is promoted to `confirmed`
- WHEN the promotion completes
- THEN the system MUST send that attendee the confirmation email with QR pass and backup code

### Requirement: Configurable Reminder Email
The system MUST send exactly one reminder email per registration per event, timed according to that event's configured reminder offset (see `event-management`).

#### Scenario: Reminder sent at configured offset
- GIVEN an event's reminder offset has elapsed relative to the event start for a confirmed registration
- WHEN the reminder dispatch process runs
- THEN the system MUST send that attendee a reminder email
- AND MUST NOT send a second reminder for the same registration

### Requirement: Webhook-Driven Reminder Trigger
Because the hosting plan cannot schedule native cron more frequently than once per day, the system MUST expose a protected webhook endpoint (for example, `/api/cron/reminders`) that an external scheduler (cron-job.org) calls to trigger reminder dispatch. The endpoint MUST reject any call that does not present a valid shared-secret authentication header. The endpoint MUST be safe to call more frequently than strictly necessary without producing duplicate sends. A single invocation MUST process all events whose reminder window has elapsed at call time.

#### Scenario: Unauthenticated webhook call is rejected
- GIVEN a request to the reminder webhook endpoint without the shared-secret header, or with an invalid value
- WHEN the request is received
- THEN the system MUST reject it and MUST NOT dispatch any reminder

#### Scenario: Authenticated webhook call processes all due reminders
- GIVEN multiple events have confirmed registrations whose reminder window has elapsed
- WHEN the webhook is called with a valid shared-secret header
- THEN the system MUST process reminder dispatch for all of those due registrations in that single invocation

#### Scenario: Repeated webhook calls do not double-send
- GIVEN the webhook was already called once and reminders were sent for all currently due registrations
- WHEN the webhook is called again before any new registration becomes due
- THEN the system MUST NOT send a duplicate reminder for any registration already logged as sent

### Requirement: Notification Log for Idempotency and Audit
The system MUST record every outbound email (confirmation, reminder, waitlist promotion) in a notification log containing, at minimum: the registration (or attendee) identifier, the notification type, the sent timestamp, and the email provider's message identifier/status. The system MUST consult this log before sending to avoid sending the same notification type twice for the same registration.

#### Scenario: Duplicate send is prevented by the log
- GIVEN a notification log entry already exists for a given registration and notification type
- WHEN the system is triggered to send that same notification type again for that registration
- THEN the system MUST NOT send a duplicate email
- AND MUST NOT create a duplicate log entry for that send

#### Scenario: Send failure is still logged
- GIVEN the email provider returns a failure status for an attempted send
- WHEN the system records the outcome
- THEN the notification log MUST capture the failed status and provider response so the send can be audited and safely retried
