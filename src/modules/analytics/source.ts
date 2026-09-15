export type AnalyticsSurface = "qr" | "links";
export type AnalyticsEventType = "qr_scan" | "link_click";
export type AnalyticsMetric = "scans" | "clicks";

type AnalyticsSource = {
  eventType: AnalyticsEventType;
  metric: AnalyticsMetric;
  singularLabel: string;
  pluralLabel: string;
  csvColumn: "scans_human" | "clicks_human";
};

const ANALYTICS_SOURCES: Record<AnalyticsSurface, AnalyticsSource> = {
  qr: {
    eventType: "qr_scan",
    metric: "scans",
    singularLabel: "escaneo",
    pluralLabel: "Escaneos",
    csvColumn: "scans_human",
  },
  links: {
    eventType: "link_click",
    metric: "clicks",
    singularLabel: "clic",
    pluralLabel: "Clics",
    csvColumn: "clicks_human",
  },
};

export function getAnalyticsSource(surface: AnalyticsSurface): AnalyticsSource {
  return ANALYTICS_SOURCES[surface];
}
