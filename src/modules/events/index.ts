// Public surface of the `events` module — the ONLY file other modules may import
// (ARCHITECTURE.md I-4). Registration and check-in service functions land in PR3/PR4
// (tasks.md Phase 3-5); this PR adds ADMIN-only event CRUD (tasks.md Phase 2).
export { generateBackupCode, generateOpaqueToken, normalizeEmail } from "./service";
export {
  createEvent,
  updateEvent,
  setEventStatus,
  listEvents,
  getEvent,
  getPublishedEventBySlug,
  getPublishedEventBySlugPublic,
  getRegistrationByCancelToken,
  registerForEvent,
  cancelRegistrationByToken,
  type EventRow,
  type EventMutationResult,
  type CreateEventInput,
  type UpdateEventChanges,
  type EventRegistrationRow,
  type EventAttendeeRow,
  type AttendeeInput,
  type UtmFields,
  type RegisterForEventInput,
  type RegisterForEventResult,
  type CancelRegistrationResult,
} from "./service";
