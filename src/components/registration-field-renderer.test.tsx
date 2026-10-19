// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegistrationFieldRenderer, type RegistrationFieldDefinition } from "./registration-field-renderer";

function field(overrides: Partial<RegistrationFieldDefinition> = {}): RegistrationFieldDefinition {
  return {
    id: "contact-name",
    type: "short_text",
    label: "Nombre de contacto",
    description: "Tu nombre completo",
    required: true,
    enabled: true,
    position: 0,
    ...overrides,
  } as RegistrationFieldDefinition;
}

describe("RegistrationFieldRenderer", () => {
  it("renders semantic inputs for supported scalar field types", () => {
    const cases = [
      ["short_text", '<input', 'type="text"'],
      ["long_text", "<textarea", ""],
      ["number", '<input', 'type="number"'],
      ["email", '<input', 'type="email"'],
      ["phone", '<input', 'type="tel"'],
      ["date", '<input', 'type="date"'],
    ] as const;

    for (const [type, element, attribute] of cases) {
      const markup = renderToStaticMarkup(<RegistrationFieldRenderer field={field({ id: type, type })} />);
      expect(markup).toContain(element);
      if (attribute) expect(markup).toContain(attribute);
      expect(markup).toContain("aria-required=\"true\"");
    }
  });

  it("renders a linked checkbox while preserving the animated checkbox classes", () => {
    const markup = renderToStaticMarkup(
      <RegistrationFieldRenderer
        field={field({
          id: "accept-contact",
          type: "checkbox",
          label: "Acepto recibir novedades",
          description: "Podés cambiar esta preferencia después.",
          link: { url: "/privacy", text: "Ver privacidad" },
        })}
      />,
    );

    expect(markup).toContain('class="check ck-10"');
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain("Ver privacidad");
    expect(markup).toContain('aria-required="true"');
  });

  it("renders multiple select options as repeatable checkbox values", () => {
    const markup = renderToStaticMarkup(
      <RegistrationFieldRenderer
        field={field({
          id: "interests",
          type: "select_multiple",
          label: "Intereses",
          required: false,
          options: [
            { value: "automation", label: "Automatización" },
            { value: "curtains", label: "Cortinas" },
          ],
        })}
      />,
    );

    expect(markup.match(/name="interests"/g)).toHaveLength(2);
    expect(markup).toContain("Automatización");
    expect(markup).toContain("Cortinas");
  });
});
