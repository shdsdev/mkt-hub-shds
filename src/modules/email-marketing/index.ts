export {
  normalizeContactEmail,
  preserveContactStatus,
  resolveInitialContactStatus,
  syncEventAttendeeContact,
  listEmailCampaigns,
  listEmailContacts,
  createEmailCampaign,
  parseEmailSegmentDefinition,
  transitionEmailCampaignStatus,
  type EventAttendeeContactInput,
  type EmailContactStatus,
  type EmailCampaign,
  type EmailContact,
  type CreateEmailCampaignInput,
  type EmailSegmentDefinition,
  type EmailCampaignStatus,
} from "./service";
export {
  parseEmailContentDocument,
  parseEmailCampaignContent,
  type EmailContentBlock,
  type EmailContentDocument,
  type EmailHtmlDocument,
  type EmailCampaignContent,
} from "./content-schema";
export { renderEmailHtml, type EmailPersonalization } from "./render-email";
