// Server-side validation for UTM template fields and custom parameter pairs. Pure functions — no
// I/O, deterministic, and shared by the settings actions and the UTM service.
import { normalizeUtmValue } from "@/lib/utm";
import {
  SOURCE_OPTIONS,
  MEDIUM_OPTIONS,
  isActiveTaxonomyValue,
  getRecommendedMediumsForSource,
} from "./taxonomy";

// "controlled" = select from the approved catalog; "partner"/"external" = a custom source, allowed
// only for partner/external cases (spec: custom source requires partner or external mode).
export type SourceMode = "controlled" | "partner" | "external";

export type CustomParameter = { key: string; value: string };

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

const RESERVED_UTM_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
]);

const CUSTOM_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function normalizeOrEmpty(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return normalizeUtmValue(trimmed);
  } catch {
    return undefined;
  }
}

export function validateSourceValue(rawSource: string, mode: SourceMode): ValidationResult {
  const source = rawSource.trim();
  if (!source) {
    return { valid: false, errors: ["El source es obligatorio."], warnings: [] };
  }
  const normalized = normalizeOrEmpty(source);
  if (!normalized) {
    return { valid: false, errors: [`El source "${source}" es inválido.`], warnings: [] };
  }
  if (mode === "partner" || mode === "external") {
    return { valid: true, errors: [], warnings: [] };
  }
  if (!isActiveTaxonomyValue(SOURCE_OPTIONS, normalized)) {
    return {
      valid: false,
      errors: [`El source "${normalized}" no es un valor de taxonomía aprobado.`],
      warnings: [],
    };
  }
  return { valid: true, errors: [], warnings: [] };
}

export function validateMediumValue(rawMedium: string): ValidationResult {
  const medium = rawMedium.trim();
  if (!medium) {
    return { valid: false, errors: ["El medium es obligatorio."], warnings: [] };
  }
  const normalized = normalizeOrEmpty(medium);
  if (!normalized) {
    return { valid: false, errors: [`El medium "${medium}" es inválido.`], warnings: [] };
  }
  if (!isActiveTaxonomyValue(MEDIUM_OPTIONS, normalized)) {
    return {
      valid: false,
      errors: [`El medium "${normalized}" no es un valor de taxonomía aprobado.`],
      warnings: [],
    };
  }
  return { valid: true, errors: [], warnings: [] };
}

// Never blocks a valid save — a non-recommended pairing is surfaced as a warning only (spec).
export function validatePairing(rawSource: string, rawMedium: string): ValidationResult {
  const source = normalizeOrEmpty(rawSource);
  const medium = normalizeOrEmpty(rawMedium);
  if (!source || !medium) {
    return { valid: true, errors: [], warnings: [] };
  }
  const recommended = getRecommendedMediumsForSource(source);
  if (recommended.length > 0 && !recommended.includes(medium)) {
    return {
      valid: true,
      errors: [],
      warnings: [`El source "${source}" no se recomienda con el medium "${medium}".`],
    };
  }
  return { valid: true, errors: [], warnings: [] };
}

export function validateCustomParameters(pairs: CustomParameter[]): ValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const key = pair.key.trim();
    const lowerKey = key.toLowerCase();
    if (!key) {
      errors.push("La clave del parámetro personalizado no puede estar vacía.");
      continue;
    }
    if (RESERVED_UTM_KEYS.has(lowerKey)) {
      errors.push(`La clave "${key}" está reservada para campos UTM.`);
      continue;
    }
    if (!CUSTOM_KEY_PATTERN.test(key)) {
      errors.push(`La clave "${key}" tiene un formato inválido.`);
      continue;
    }
    if (seen.has(lowerKey)) {
      errors.push(`La clave "${key}" está duplicada.`);
      continue;
    }
    if (!pair.value.trim()) {
      errors.push(`El parámetro "${key}" no puede tener un valor vacío.`);
      continue;
    }
    seen.add(lowerKey);
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
