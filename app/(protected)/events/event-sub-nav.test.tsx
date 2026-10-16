import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventSubNav } from "./event-sub-nav";

describe("EventSubNav", () => {
  it("places Sorteo between the internal form and results for admins", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="raffle" role="ADMIN" />);
    expect(html.indexOf("Formulario interno")).toBeLessThan(html.indexOf("Sorteo"));
    expect(html.indexOf("Sorteo")).toBeLessThan(html.indexOf("Resultados"));
  });

  it("keeps Sorteo hidden from reception users", () => {
    const html = renderToStaticMarkup(<EventSubNav eventId="event-1" current="registrations" role="RECEPTION" />);
    expect(html).not.toContain("Sorteo");
  });
});
