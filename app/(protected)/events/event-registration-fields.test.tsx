// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { RegistrationFormConfig } from "@/modules/events";
import { EventRegistrationFields } from "./event-registration-fields";

const config: RegistrationFormConfig = {
  version: 1,
  customFieldsVersion: 1,
  customFields: [{
    id: "custom-date-1",
    type: "date",
    label: "Fecha de visita",
    description: "",
    required: true,
    enabled: true,
    position: 0,
    section: "personal",
  }],
  fields: {
    phone: { visible: false, required: false },
    company: { visible: false, required: false },
    jobTitle: { visible: false, required: false },
    state: { visible: false, required: false },
  },
  companion: { enabled: true },
  clientBrands: { enabled: false, options: [] },
  interests: { enabled: false, options: [] },
  consent: {
    privacy: { url: "/privacy", text: "Privacidad" },
    terms: { url: "/terms", text: "Términos" },
    marketing: { enabled: false, text: "Marketing" },
  },
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("EventRegistrationFields", () => {
  it("renders preview controls as disabled so required fields do not block saving the configuration form", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<form><EventRegistrationFields initialFormConfig={config} /></form>);
    });

    expect(container.querySelector('input[type="date"]')).toHaveProperty("disabled", true);
  });
});
