import { randomUUID } from "node:crypto";
import { isKnownBot } from "./bot";
import type { trackingEvents } from "./db";

export type TrackRedirectInput = {
  organizationId: string;
  linkId: string;
  shortLinkId: string;
  qrCodeId?: string;
  campaignId?: string | null;
  sourceType: "link_click" | "qr_scan";
  visitorHash: string;
  userAgent: string | null;
  deviceType?: string;
  geoCountry?: string;
  geoCity?: string;
  geoRegion?: string;
  referrer?: string;
  consentGranted: boolean;
  analyticsConsentId?: string;
};

export type BufferedTrackingEvent = typeof trackingEvents.$inferInsert & { ga4ConsentGranted: boolean; analyticsConsentId?: string };

export function buildTrackingEvent(input: TrackRedirectInput, now = new Date()): BufferedTrackingEvent {
  const isBot = isKnownBot(input.userAgent);
  return {
    id: randomUUID(),
    organizationId: input.organizationId,
    linkId: input.linkId,
    shortLinkId: input.shortLinkId,
    qrCodeId: input.qrCodeId,
    campaignId: input.campaignId ?? undefined,
    sourceType: input.sourceType,
    isBot,
    visitorHash: input.visitorHash,
    sessionStartedAt: now,
    deviceType: input.deviceType,
    geoCountry: input.geoCountry,
    geoCity: input.geoCity,
    region: input.geoRegion,
    referrer: input.referrer,
    createdAt: now,
    ga4ConsentGranted: input.consentGranted && !isBot,
    analyticsConsentId: input.analyticsConsentId,
  };
}
