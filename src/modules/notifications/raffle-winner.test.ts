import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, insertMock, updateMock, fetchMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: { select: selectMock, insert: insertMock, update: updateMock } }));

import { renderRaffleWinnerEmailHtml, sendRaffleWinnerEmail } from "./service";

function selectChain<T>(rows: T[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  return chain;
}

function insertChain<T>(rows: T[]) {
  const chain = { values: vi.fn(), returning: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);
  return chain;
}

function updateChain() {
  const chain = { set: vi.fn(), where: vi.fn() };
  chain.set.mockReturnValue(chain);
  chain.where.mockResolvedValue(undefined);
  return chain;
}

describe("raffle winner notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM = "events@example.com";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "provider-1" }) });
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockReturnValue(selectChain([]));
    insertMock.mockReturnValue(insertChain([{ id: "notification-1" }]));
    updateMock.mockReturnValue(updateChain());
  });

  it("escapes all dynamic HTML and records a first successful send", async () => {
    const result = await sendRaffleWinnerEmail({
      organizationId: "org-1",
      drawId: "00000000-0000-4000-8000-000000000001",
      to: "winner@example.com",
      winnerName: "Winner <script>alert(1)</script>",
      eventName: "Launch & Learn",
      prizeName: "Gift \"card\"",
      registrationCode: "REG-123",
      redemptionCode: "DRAW-456",
      reason: "Please resend <now>",
    });

    expect(result.status).toBe("sent");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.to).toBe("winner@example.com");
    expect(payload.html).not.toContain("<script>alert(1)</script>");
    expect(payload.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(payload.html).toContain("REG-123");
    expect(payload.html).toContain("DRAW-456");
    expect(insertMock).toHaveBeenCalledWith(expect.anything());
    expect(updateMock).toHaveBeenCalledWith(expect.anything());
  });

  it("marks the notification failed when Resend rejects the provider call", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => "unavailable" });

    await expect(sendRaffleWinnerEmail({
      organizationId: "org-1",
      drawId: "00000000-0000-4000-8000-000000000001",
      to: "winner@example.com",
      winnerName: "Winner",
      eventName: "Launch",
      prizeName: "Gift",
      registrationCode: "REG-123",
      redemptionCode: "DRAW-456",
      reason: null,
    })).rejects.toThrow("Winner email provider failed");

    expect(updateMock).toHaveBeenCalledWith(expect.anything());
  });

  it("renders separate registration and redemption codes", () => {
    const html = renderRaffleWinnerEmailHtml({
      winnerName: "Javier <Test>",
      winnerEmail: "javier@example.com",
      eventName: "Shades Spaces",
      prizeName: "Motor 45 mm",
      registrationCode: "REG-123",
      redemptionCode: "PREM-456",
      instructions: "Presenta este código en el módulo de entrega.",
      claimDeadlineAt: new Date("2026-12-30T18:18:00.000Z"),
    });

    expect(html).toContain("CÓDIGO DE REGISTRO");
    expect(html).toContain("CÓDIGO DE CANJE");
    expect(html).toContain("REG-123");
    expect(html).toContain("PREM-456");
    expect(html).toContain("Javier &lt;Test&gt;");
    expect(html).not.toContain("Javier <Test>");
  });
});
