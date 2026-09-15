"use client";

import { Map, MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/map";
import { COUNTRY_CENTROIDS } from "@/lib/country-centroids";

type BreakdownRow = { label: string; count: number };

const MIN_CIRCLE_SIZE = 10;
const MAX_CIRCLE_SIZE = 36;

// Fed { countryCode, count } from getOrgBreakdowns' country dimension — circles scaled by count,
// positioned at each country's approximate centroid (src/lib/country-centroids.ts). A country
// code with no known centroid simply gets no marker rather than guessing a position.
export function OrgMap({ rows }: { rows: BreakdownRow[] | undefined }) {
  const points = (rows ?? [])
    .map((row) => ({ ...row, centroid: COUNTRY_CENTROIDS[row.label] }))
    .filter((row): row is BreakdownRow & { centroid: [number, number] } => Boolean(row.centroid));
  const maxCount = points.reduce((max, row) => Math.max(max, row.count), 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">Mapa</p>
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
      ) : (
        <div className="h-80 overflow-hidden rounded-md">
          <Map
            // Explicit, not auto-detected: this app's theme switcher (Signature/Midnight/
            // Nightfall/Greydlu) sets `data-app-theme`, not the `.dark`/`.light` class or generic
            // `data-theme` attribute @mapcn/map's auto-detection checks for — every theme here is
            // a dark palette, so "dark" is correct regardless of which one is active.
            theme="dark"
            projection={{ type: "mercator" }}
            viewport={{ center: [0, 15], zoom: 1, bearing: 0, pitch: 0 }}
          >
            {points.map((point) => {
              const size =
                maxCount > 0
                  ? MIN_CIRCLE_SIZE + (point.count / maxCount) * (MAX_CIRCLE_SIZE - MIN_CIRCLE_SIZE)
                  : MIN_CIRCLE_SIZE;
              return (
                <MapMarker key={point.label} longitude={point.centroid[0]} latitude={point.centroid[1]}>
                  <MarkerContent>
                    <div
                      className="rounded-full border-2 border-background bg-accent/70"
                      style={{ width: size, height: size }}
                    />
                  </MarkerContent>
                  <MarkerTooltip>
                    {point.label}: {point.count}
                  </MarkerTooltip>
                </MapMarker>
              );
            })}
          </Map>
        </div>
      )}
    </div>
  );
}
