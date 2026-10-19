// Public surface of the `notifications` module — the ONLY file other modules may import
// (ARCHITECTURE.md I-4).
export {
  createInternalNotifications,
  listUserNotifications,
  markUserNotificationRead,
  claimNotification,
  markNotificationSent,
  markNotificationFailed,
  sendConfirmationEmail,
  sendRegistrationDecisionEmail,
  sendWaitlistPromotionEmail,
  sendReminderEmail,
  sendRaffleWinnerEmail,
  type NotificationSubjectType,
  type NotificationType,
  type NotificationLogRow,
  type ClaimNotificationInput,
  type SendEmailResult,
  type AttendeeEmailInput,
  type RaffleWinnerEmailInput,
  type RaffleWinnerEmailResult,
  type UserNotificationRow,
  type CreateInternalNotificationsInput,
} from "./service";
export { buildRegistrationTelegramMessage, sendTelegramMessage, type TelegramReplyMarkup } from "./telegram";
