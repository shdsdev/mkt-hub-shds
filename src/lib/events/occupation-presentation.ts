export type OccupationPresentation = {
  label: string;
  color: string;
  className: string;
  surfaceClassName: string;
  style?: { backgroundColor: string; color: string };
};

type ConfiguredOccupation = {
  value: string;
  label: string;
  color: string;
  enabled: boolean;
};

type NamedColor = "orange" | "blue" | "green" | "yellow" | "red" | "neutral";

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

const COLOR_CLASSES: Record<NamedColor, Pick<OccupationPresentation, "className" | "surfaceClassName">> = {
  orange: { className: "bg-orange-600 text-white", surfaceClassName: "border-orange-500/40 bg-orange-500/10" },
  blue: { className: "bg-blue-600 text-white", surfaceClassName: "border-blue-500/40 bg-blue-500/10" },
  green: { className: "bg-green-600 text-white", surfaceClassName: "border-green-500/40 bg-green-500/10" },
  yellow: { className: "bg-yellow-500 text-black", surfaceClassName: "border-yellow-500/40 bg-yellow-500/10" },
  red: { className: "bg-red-600 text-white", surfaceClassName: "border-red-500/40 bg-red-500/10" },
  neutral: { className: "bg-muted text-muted-foreground", surfaceClassName: "border-border bg-muted/30" },
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function getCustomColorPresentation(color: string): Pick<OccupationPresentation, "className" | "surfaceClassName" | "style"> {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return {
    className: "",
    surfaceClassName: "",
    style: {
      backgroundColor: color,
      color: luminance > 0.62 ? "#111111" : "#ffffff",
    },
  };
}

export function getOccupationPresentation(occupation?: string | null, options?: readonly ConfiguredOccupation[]): OccupationPresentation {
  const configured = options?.find((option) => option.value === occupation);
  if (configured) {
    const colorPresentation = HEX_COLOR_PATTERN.test(configured.color)
      ? getCustomColorPresentation(configured.color)
      : COLOR_CLASSES[configured.color as NamedColor] ?? COLOR_CLASSES.neutral;
    return { label: configured.label, color: configured.color, ...colorPresentation };
  }
  return PRESENTATIONS[occupation ?? ""] ?? UNKNOWN_PRESENTATION;
}
