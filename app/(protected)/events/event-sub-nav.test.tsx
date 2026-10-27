import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventSubNav } from "./event-sub-nav";

describe("EventSubNav", () => {
  it("places Sorteo between the internal form and results for admins", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="raffle" role="ADMIN" />);
    expect(html.indexOf("Formulario interno")).toBeLessThan(html.indexOf("Sorteo"));
    expect(html.indexOf("Sorteo")).toBeLessThan(html.indexOf("Resultados"));
  });

  it("shows operational sections and active results to reception users", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="dashboard" role="RECEPTION" />);
    expect(html).not.toContain("Sorteo");
    expect(html).not.toContain("Editar");
    expect(html).not.toContain("Preguntas");
    expect(html).toContain("Resultados");
    expect(html).toMatch(/<a(?=[^>]*href="\/events\/event-1\/dashboard")(?=[^>]*aria-current="page")[^>]*>/);
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

  it("keeps the current section selected instead of defaulting to Editar", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="questions" role="ADMIN" />);

    expect(html).toMatch(/<a(?=[^>]*href="\/events\/event-1\/questions")(?=[^>]*aria-current="page")(?=[^>]*bg-accent)[^>]*>Preguntas<\/a>/);
    expect(html).not.toMatch(/<a(?=[^>]*href="\/events\/event-1\/edit")(?=[^>]*aria-current="page")/);
  });
});
