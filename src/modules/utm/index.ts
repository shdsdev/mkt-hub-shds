// Public surface of the `utm` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  createUtmPreset,
  updateUtmPreset,
  listUtmPresets,
  listActiveUtmTemplates,
  getActiveUtmTemplate,
  archiveUtmPreset,
  normalizeTemplateValues,
  type UtmPreset,
  type ApplyableUtmTemplate,
  type CreateUtmPresetInput,
  type UpdateUtmPresetInput,
  type TemplateStatus,
} from "./service";
export {
  SOURCE_OPTIONS,
  MEDIUM_OPTIONS,
  getActiveTaxonomyOptions,
  getDeprecatedTaxonomyOptions,
  searchTaxonomyOptions,
  findActiveTaxonomyOption,
  getRecommendedMediumsForSource,
  type TaxonomyOption,
  type TaxonomyStatus,
} from "./taxonomy";
export {
  validateSourceValue,
  validateMediumValue,
  validatePairing,
  validateCustomParameters,
  type SourceMode,
  type CustomParameter,
  type ValidationResult,
} from "./validation";
