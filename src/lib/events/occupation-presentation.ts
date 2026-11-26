export type OccupationPresentation = {
  label: string;
  color: "orange" | "blue" | "green" | "yellow" | "red" | "neutral";
  className: string;
  surfaceClassName: string;
};

type ConfiguredOccupation = {
  value: string;
  label: string;
  color: OccupationPresentation["color"];
  enabled: boolean;
};

const PRESENTATIONS: Record<string, OccupationPresentation> = {
  wholesaler: { label: "Mayorista", color: "orange", className: "bg-orange-600 text-white", surfaceClassName: "border-orange-500/40 bg-orange-500/10" },
  manufacturer: { label: "Fabricante", color: "blue", className: "bg-blue-600 text-white", surfaceClassName: "border-blue-500/40 bg-blue-500/10" },
  "architect-decorator": { label: "Arquitecto / Decorador", color: "green", className: "bg-green-600 text-white", surfaceClassName: "border-green-500/40 bg-green-500/10" },
  "installer-technician": { label: "Instalador o técnico", color: "red", className: "bg-red-600 text-white", surfaceClassName: "border-red-500/40 bg-red-500/10" },
};

const UNKNOWN_PRESENTATION: OccupationPresentation = {
  label: "Categoría no especificada",
  color: "neutral",
  className: "bg-muted text-muted-foreground",
  surfaceClassName: "border-border bg-muted/30",
};

const COLOR_CLASSES: Record<ConfiguredOccupation["color"], Pick<OccupationPresentation, "className" | "surfaceClassName">> = {
  orange: { className: "bg-orange-600 text-white", surfaceClassName: "border-orange-500/40 bg-orange-500/10" },
  blue: { className: "bg-blue-600 text-white", surfaceClassName: "border-blue-500/40 bg-blue-500/10" },
  green: { className: "bg-green-600 text-white", surfaceClassName: "border-green-500/40 bg-green-500/10" },
  yellow: { className: "bg-yellow-500 text-black", surfaceClassName: "border-yellow-500/40 bg-yellow-500/10" },
  red: { className: "bg-red-600 text-white", surfaceClassName: "border-red-500/40 bg-red-500/10" },
  neutral: { className: "bg-muted text-muted-foreground", surfaceClassName: "border-border bg-muted/30" },
};

export function getOccupationPresentation(occupation?: string | null, options?: readonly ConfiguredOccupation[]): OccupationPresentation {
  const configured = options?.find((option) => option.value === occupation);
  if (configured) {
    return { label: configured.label, color: configured.color, ...COLOR_CLASSES[configured.color] };
  }
  return PRESENTATIONS[occupation ?? ""] ?? UNKNOWN_PRESENTATION;
}
