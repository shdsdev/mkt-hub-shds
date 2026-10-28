type SegmentCondition = {
  field: "fullName" | "email" | "company" | "tag" | "event" | "subscriptionStatus";
  operator: "contains" | "not_contains" | "equals" | "not_equals" | "is_empty" | "is_not_empty" | "has" | "not_has";
  value: string;
};

type SegmentFilters = {
  logic?: "all" | "any";
  conditions?: SegmentCondition[];
  subscriptionStatuses?: string[];
  tags?: string[];
  eventIds?: string[];
};

export const segmentFieldLabels: Record<SegmentCondition["field"], string> = {
  fullName: "Nombre completo",
  email: "Correo electrónico",
  company: "Empresa",
  tag: "Etiqueta",
  event: "Evento",
  subscriptionStatus: "Estado de suscripción",
};

export const segmentOperatorLabels: Record<SegmentCondition["operator"], string> = {
  contains: "contiene",
  not_contains: "no contiene",
  equals: "es",
  not_equals: "no es",
  is_empty: "está vacío",
  is_not_empty: "no está vacío",
  has: "tiene",
  not_has: "no tiene",
};

export function describeSegmentCondition(condition: SegmentCondition): string {
  return `${segmentFieldLabels[condition.field]} ${segmentOperatorLabels[condition.operator]}${condition.value ? ` ${condition.value}` : ""}`;
}

export function describeSegmentFilters(filters: SegmentFilters): string {
  const descriptions: string[] = [];
  if (filters.conditions?.length) descriptions.push(filters.conditions.map(describeSegmentCondition).join(filters.logic === "any" ? " o " : " y "));
  if (filters.subscriptionStatuses?.includes("subscribed")) descriptions.push("Suscriptos");
  if (filters.tags?.length) descriptions.push(`Etiquetas: ${filters.tags.join(", ")}`);
  if (filters.eventIds?.length) descriptions.push(`${filters.eventIds.length} evento${filters.eventIds.length === 1 ? "" : "s"}`);
  return descriptions.length ? descriptions.join(" · ") : "Todos los contactos elegibles";
}
