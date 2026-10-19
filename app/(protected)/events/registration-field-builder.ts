import type { RegistrationCustomField } from "@/modules/events";

export type CustomFieldType = RegistrationCustomField["type"];

function nextFieldId(fields: readonly RegistrationCustomField[], type: CustomFieldType): string {
  const base = `custom-${type}`;
  let index = 1;
  while (fields.some((field) => field.id === `${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function normalizePositions(fields: readonly RegistrationCustomField[]): RegistrationCustomField[] {
  return fields.map((field, position) => ({ ...field, position }));
}

export function addCustomField(fields: readonly RegistrationCustomField[], type: CustomFieldType): RegistrationCustomField[] {
  const position = fields.length;
  const common = {
    id: nextFieldId(fields, type),
    label: "Nuevo campo",
    description: "",
    required: false,
    enabled: true,
    position,
    section: "personal" as const,
  };

  const field: RegistrationCustomField = type === "number"
    ? { ...common, type, min: undefined, max: undefined }
    : type === "checkbox"
      ? { ...common, type }
      : type === "select" || type === "select_multiple"
        ? { ...common, type, options: [{ value: "option-1", label: "Opción 1" }] }
        : { ...common, type };

  return normalizePositions([...fields, field]);
}

export function updateCustomField(
  fields: readonly RegistrationCustomField[],
  id: string,
  changes: Partial<RegistrationCustomField>,
): RegistrationCustomField[] {
  return fields.map((field) => field.id === id ? { ...field, ...changes } as RegistrationCustomField : field);
}

export function removeCustomField(fields: readonly RegistrationCustomField[], id: string): RegistrationCustomField[] {
  return normalizePositions(fields.filter((field) => field.id !== id));
}

export function moveCustomField(fields: readonly RegistrationCustomField[], id: string, targetPosition: number): RegistrationCustomField[] {
  const currentIndex = fields.findIndex((field) => field.id === id);
  if (currentIndex < 0) return [...fields];

  const next = [...fields];
  const [field] = next.splice(currentIndex, 1);
  next.splice(Math.max(0, Math.min(targetPosition, next.length)), 0, field);
  return normalizePositions(next);
}
