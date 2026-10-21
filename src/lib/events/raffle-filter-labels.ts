type RaffleFilterName = "occupation" | "clientBrands" | "interests";

const LABELS: Record<RaffleFilterName, Record<string, string>> = {
  occupation: {
    wholesaler: "Mayorista",
    manufacturer: "Fabricante",
    "architect-decorator": "Arquitecto / Decorador",
    "installer-technician": "Instalador o técnico",
  },
  clientBrands: {
    none: "Ninguna",
    shades: "Shades",
    bmighty: "BMighty",
    drapery: "Drapery",
  },
  interests: {
    "battery-motors": "Motores de baterías",
    "wifi-automation": "Automatización por Wi-Fi",
    curtains: "Cortinas",
    "manual-and-motorized-rods": "Cortineros manuales y motorizados",
  },
};

export function getRaffleFilterLabel(name: RaffleFilterName, value: string): string {
  return LABELS[name][value] ?? value;
}

export function getRaffleFilterOptions(name: RaffleFilterName, values: string[]) {
  return [{ value: "all", label: name === "interests" ? "Todos" : "Todas" }, ...values.map((value) => ({ value, label: getRaffleFilterLabel(name, value) }))];
}
