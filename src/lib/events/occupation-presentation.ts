export type OccupationPresentation = {
  label: string;
  color: "orange" | "blue" | "green" | "yellow" | "red" | "neutral";
  className: string;
  surfaceClassName: string;
};

const PRESENTATIONS: Record<string, OccupationPresentation> = {
  distributor: { label: "Distribuidor", color: "orange", className: "bg-orange-600 text-white", surfaceClassName: "border-orange-500/40 bg-orange-500/10" },
  manufacturer: { label: "Fabricante", color: "blue", className: "bg-blue-600 text-white", surfaceClassName: "border-blue-500/40 bg-blue-500/10" },
  architect: { label: "Arquitecto", color: "green", className: "bg-green-600 text-white", surfaceClassName: "border-green-500/40 bg-green-500/10" },
  decorator: { label: "Decorador", color: "yellow", className: "bg-yellow-700 text-white", surfaceClassName: "border-yellow-400/40 bg-yellow-400/10" },
  "installer-technician": { label: "Instalador o técnico", color: "red", className: "bg-red-600 text-white", surfaceClassName: "border-red-500/40 bg-red-500/10" },
};

const UNKNOWN_PRESENTATION: OccupationPresentation = {
  label: "Categoría no especificada",
  color: "neutral",
  className: "bg-muted text-muted-foreground",
  surfaceClassName: "border-border bg-muted/30",
};

export function getOccupationPresentation(occupation?: string | null): OccupationPresentation {
  return PRESENTATIONS[occupation ?? ""] ?? UNKNOWN_PRESENTATION;
}
