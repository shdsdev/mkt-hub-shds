import { EventAnalyticsPanel } from "@/components/analytics/event-analytics-panel";

export function ScansPanel({ linkId }: { linkId: string }) {
  return (
    <EventAnalyticsPanel
      linkId={linkId}
      heading="Escaneos"
      surface="qr"
      dataUrl={`/analytics/${linkId}/data`}
      csvUrl={`/analytics/${linkId}/csv`}
      emptyMessage="Aún no hay escaneos en este rango."
      showBreakdowns
    />
  );
}
