import { describe, expect, it, vi } from "vitest";
import { buildRegistrationTelegramMessage, sendTelegramMessage } from "./telegram";

describe("Telegram registration notifications", () => {
  it("builds a concise review message with a direct action link", () => {
    expect(buildRegistrationTelegramMessage({ eventName: "Workshop", reviewUrl: "https://hub.test/events/1/registrations/2" })).toEqual({
      text: "Nuevo registro para Workshop\nHay una nueva solicitud pendiente de revisión. Revisá al candidato para decidir si puede asistir.",
      replyMarkup: { inline_keyboard: [[{ text: "Revisar solicitud", url: "https://hub.test/events/1/registrations/2" }]] },
    });
  });

  it("omits the inline button for a localhost review URL", () => {
    expect(buildRegistrationTelegramMessage({ eventName: "Workshop", reviewUrl: "http://localhost:3000/events/1/registrations/2" }).replyMarkup)
      .toEqual({ inline_keyboard: [] });
  });

  it("renders supported tags in a custom template", () => {
    expect(buildRegistrationTelegramMessage({
      eventName: "Workshop",
      reviewUrl: "https://hub.test/review/1",
      template: "{{nombre}} de {{empresa}} trabaja como {{ocupacion}} en {{evento}}.",
      values: { nombre: "Ada", empresa: "Acme", ocupacion: "Arquitecta" },
    }).text).toBe("Ada de Acme trabaja como Arquitecta en Workshop.");
  });

  it("rejects unknown template tags", () => {
    expect(() => buildRegistrationTelegramMessage({
      eventName: "Workshop",
      reviewUrl: "https://hub.test/review/1",
      template: "{{nombre_completo}}",
    })).toThrow("La etiqueta {{nombre_completo}} no está disponible.");
  });

  it("sends the message through Telegram's sendMessage endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendTelegramMessage({ token: "bot-token", chatId: "-100123", text: "Solicitud", replyMarkup: { inline_keyboard: [] } });

    expect(fetchMock).toHaveBeenCalledWith("https://api.telegram.org/botbot-token/sendMessage", expect.objectContaining({ method: "POST" }));
    fetchMock.mockRestore();
  });

  it("includes Telegram's safe rejection description in the thrown error", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 }),
    );

    await expect(sendTelegramMessage({ token: "bot-token", chatId: "-100123", text: "Solicitud", replyMarkup: { inline_keyboard: [] } }))
      .rejects.toThrow("Bad Request: chat not found");

    fetchMock.mockRestore();
  });
});
