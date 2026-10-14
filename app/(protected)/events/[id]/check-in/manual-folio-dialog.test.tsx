import { describe, expect, it } from "vitest";
import { manualFolioErrorGuidance } from "./manual-folio-dialog";

describe("ManualFolioDialog errors", () => {
  it("keeps manual lookup retry guidance stable for the open modal", () => {
    expect(manualFolioErrorGuidance).toBe("Revisá el folio y volvé a intentar.");
  });
});
