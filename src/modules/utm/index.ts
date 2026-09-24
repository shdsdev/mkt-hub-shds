// Public surface of the `utm` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  createUtmPreset,
  listUtmPresets,
  deleteUtmPreset,
  type UtmPreset,
  type CreateUtmPresetInput,
} from "./service";
