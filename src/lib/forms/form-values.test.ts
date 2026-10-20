// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { restoreFormValues, snapshotFormValues } from "./form-values";

describe("form value preservation", () => {
  it("restores text, checkbox, and radio values after a form reset", () => {
    const form = document.createElement("form");
    form.innerHTML = `
      <input name="fullName" value="Ada Lovelace">
      <input name="interests" type="checkbox" value="curtains" checked>
      <input name="companionCompanyMode" type="radio" value="same">
      <input name="companionCompanyMode" type="radio" value="other" checked>
    `;
    document.body.append(form);

    const snapshot = snapshotFormValues(form);
    form.reset();
    restoreFormValues(form, snapshot);

    expect((form.elements.namedItem("fullName") as HTMLInputElement).value).toBe("Ada Lovelace");
    expect((form.elements.namedItem("interests") as HTMLInputElement).checked).toBe(true);
    expect((form.elements.namedItem("companionCompanyMode") as RadioNodeList).value).toBe("other");
  });
});
