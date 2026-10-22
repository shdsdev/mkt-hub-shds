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
  type EmailContentBlock,
  type EmailContentDocument,
} from "./content-schema";
export { renderEmailHtml, type EmailPersonalization } from "./render-email";
