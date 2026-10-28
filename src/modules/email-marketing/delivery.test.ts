import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, updateMock, sendViaResendMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  sendViaResendMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: { select: selectMock, update: updateMock } }));
vi.mock("@/lib/env", () => ({
  env: {
    MARKETING_HUB_SERVER_TOKEN: "test-server-token",
    NEXT_PUBLIC_APP_ORIGIN: "https://shmx.men",
    RESEND_MARKETING_FROM: "Shades + Spaces <marketing@example.com>",
    RESEND_MARKETING_REPLY_TO: "events@example.com",
  },
}));
vi.mock("@/modules/notifications", () => ({ sendViaResend: sendViaResendMock }));

import { sendEmailCampaignRecipient } from "./service";

function selectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  return chain;
}

function updateChain() {
  const chain = { set: vi.fn(), where: vi.fn() };
  chain.set.mockReturnValue(chain);
  chain.where.mockResolvedValue(undefined);
  return chain;
}

describe("email campaign delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendViaResendMock.mockResolvedValue({ ok: true, messageId: "resend-message-1" });
    updateMock.mockReturnValue(updateChain());
  });

  it("sends the marketing identity and one-click unsubscribe headers", async () => {
    selectMock
      .mockReturnValueOnce(selectChain([{
        id: "recipient-1",
        organizationId: "org-1",
        campaignId: "campaign-1",
        contactId: "contact-1",
        email: "contact@example.com",
        status: "pending",
        personalization: {},
      }]))
      .mockReturnValueOnce(selectChain([{
        id: "campaign-1",
        organizationId: "org-1",
        subject: "Novedades",
        content: { version: 1, blocks: [{ id: "text-1", type: "text", text: "Hola" }] },
      }]));

    const result = await sendEmailCampaignRecipient("recipient-1");

    expect(result).toEqual({ sent: true, messageId: "resend-message-1" });
    expect(sendViaResendMock).toHaveBeenCalledWith(expect.objectContaining({
      from: "Shades + Spaces <marketing@example.com>",
      replyTo: "events@example.com",
      headers: expect.objectContaining({
        "List-Unsubscribe": expect.stringMatching(/^<https:\/\/shmx\.men\/email\/unsubscribe\//),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }),
    }));
  });
});
