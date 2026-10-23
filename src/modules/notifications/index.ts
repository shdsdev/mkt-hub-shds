// Public surface of the `notifications` module — the ONLY file other modules may import
// (ARCHITECTURE.md I-4).
export {
  createInternalNotifications,
  listUserNotifications,
  markUserNotificationRead,
  claimNotification,
  listReminderNotificationStatuses,
  getReminderNotificationStatusCounts,
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
export { summarizeReminderStatuses, type ReminderStatusSummary } from "./reminder-diagnostics";
export { buildRegistrationTelegramMessage, sendTelegramMessage, type TelegramReplyMarkup } from "./telegram";
export {
  DEFAULT_TELEGRAM_TEMPLATE,
  TELEGRAM_TEMPLATE_TAGS,
  renderTelegramTemplate,
  validateTelegramTemplate,
  type TelegramTemplateTag,
  type TelegramTemplateValues,
} from "./telegram-template";
export {
  getTelegramSettings,
  upsertTelegramSettings,
  resolveTelegramChatId,
  resolveTelegramMessageTemplate,
  type TelegramSettings,
} from "./telegram-settings";
