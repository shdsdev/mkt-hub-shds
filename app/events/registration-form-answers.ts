import { z } from "zod";
import type { RegistrationCustomField, RegistrationFormAnswers } from "@/modules/events";

type ParseAnswersResult =
  | { ok: true; answers: RegistrationFormAnswers }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function valuesFor(formData: FormData, fieldId: string): string[] {
  return formData.getAll(fieldId).map((value) => typeof value === "string" ? value.trim() : "");
}

function invalid(field: RegistrationCustomField, message: string): ParseAnswersResult {
  return { ok: false, error: `${field.label}: ${message}`, fieldErrors: { [field.id]: message } };
}

export function parseRegistrationFormAnswers(
  fields: readonly RegistrationCustomField[],
  formData: FormData,
  allowedKeys: readonly string[] = [],
): ParseAnswersResult {
  const answers: RegistrationFormAnswers = {};
  const knownIds = new Set(fields.map((field) => field.id));
  const acceptedKeys = new Set([...knownIds, ...allowedKeys]);

  for (const key of new Set(Array.from(formData.keys()))) {
    if (key.startsWith("$ACTION_")) continue;
    if (!acceptedKeys.has(key)) return { ok: false, error: "El formulario contiene un campo no válido." };
  }

  for (const field of fields) {
    if (!field.enabled) continue;
    const values = valuesFor(formData, field.id);

    if (field.type === "checkbox") {
      const checked = values.some((value) => value === "true" || value === "on");
      if (field.required && !checked) return invalid(field, "debe estar seleccionado.");
      answers[field.id] = { label: field.label, type: field.type, value: checked };
      continue;
    }

    if (field.type === "select_multiple") {
      if (new Set(values).size !== values.length) return invalid(field, "no puede repetir opciones.");
      const allowed = new Set(field.options.map((option) => option.value));
      if (values.some((value) => !allowed.has(value))) return invalid(field, "contiene una opción no válida.");
      if (field.required && values.length === 0) return invalid(field, "es obligatorio.");
      answers[field.id] = { label: field.label, type: field.type, value: values };
      continue;
    }

    const value = values[0] ?? "";
    if (field.required && !value) return invalid(field, "es obligatorio.");

    if (field.type === "select") {
      if (value && !field.options.some((option) => option.value === value)) return invalid(field, "contiene una opción no válida.");
      answers[field.id] = { label: field.label, type: field.type, value: value || null };
      continue;
    }

    if (field.type === "number") {
      if (!value) {
        answers[field.id] = { label: field.label, type: field.type, value: null };
        continue;
      }
      const number = Number(value);
      if (!Number.isFinite(number) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) {
        return invalid(field, "debe ser un número válido dentro del rango permitido.");
      }
      answers[field.id] = { label: field.label, type: field.type, value: number };
      continue;
    }

    if (field.type === "email" && !z.string().email().safeParse(value).success) return invalid(field, "debe ser un correo válido.");
    if (field.type === "date" && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) return invalid(field, "debe ser una fecha válida.");
    if (value.length > (field.type === "long_text" ? 5000 : 500)) return invalid(field, "es demasiado largo.");
    answers[field.id] = { label: field.label, type: field.type, value: value || null };
  }

  return { ok: true, answers };
}
