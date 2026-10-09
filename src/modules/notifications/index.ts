// Public surface of the `notifications` module — the ONLY file other modules may import
// (ARCHITECTURE.md I-4).
export {
  claimNotification,
  markNotificationSent,
  markNotificationFailed,
  sendConfirmationEmail,
  sendWaitlistPromotionEmail,
  sendReminderEmail,
  type NotificationSubjectType,
  type NotificationType,
  type NotificationLogRow,
  type ClaimNotificationInput,
  type SendEmailResult,
  type AttendeeEmailInput,
} from "./service";
