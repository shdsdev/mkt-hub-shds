import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventSubNav } from "./event-sub-nav";

describe("EventSubNav", () => {
  it("places Sorteo between the internal form and results for admins", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="raffle" role="ADMIN" />);
    expect(html.indexOf("Formulario interno")).toBeLessThan(html.indexOf("Sorteo"));
    expect(html.indexOf("Sorteo")).toBeLessThan(html.indexOf("Resultados"));
  });

  it("shows only operational sections to reception users", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="registrations" role="RECEPTION" />);
    expect(html).not.toContain("Sorteo");
    expect(html).not.toContain("Editar");
    expect(html).not.toContain("Preguntas");
    expect(html).not.toContain("Resultados");
    expect(html).toContain("Registros");
    expect(html).toContain("Check-in");
    expect(html).toContain("Formulario interno");
  });

  it("shows every event section to event editors", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="edit" role="EVENT_EDITOR" />);
    expect(html).toContain("Editar");
    expect(html).toContain("Registros");
    expect(html).toContain("Check-in");
    expect(html).toContain("Formulario interno");
    expect(html).toContain("Sorteo");
    expect(html).toContain("Preguntas");
    expect(html).toContain("Resultados");
  });
});
