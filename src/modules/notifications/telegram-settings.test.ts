import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, insertMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: { select: selectMock, insert: insertMock } }));

import { getTelegramSettings, resolveTelegramChatId, resolveTelegramMessageTemplate, upsertTelegramSettings } from "./telegram-settings";

function selectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  return chain;
}

function insertChain(row: unknown) {
  const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn(), returning: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockReturnValue(chain);
  chain.returning.mockResolvedValue(row ? [row] : []);
  return chain;
}

describe("Telegram settings service", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads settings by organization", async () => {
    const settings = { organizationId: "org-1", chatId: "-100123", enabled: true };
    selectMock.mockReturnValue(selectChain([settings]));

    await expect(getTelegramSettings("org-1")).resolves.toEqual(settings);
  });

  it("upserts organization settings", async () => {
    const settings = { organizationId: "org-1", chatId: "-100123", enabled: true };
    const chain = insertChain(settings);
    insertMock.mockReturnValue(chain);

    await expect(upsertTelegramSettings({ organizationId: "org-1", chatId: "-100123", enabled: true, messageTemplate: null })).resolves.toEqual(settings);
    expect(chain.onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({ set: expect.objectContaining({ chatId: "-100123", enabled: true }) }));
  });

  it("prefers an event destination and otherwise resolves the enabled global destination", async () => {
    await expect(resolveTelegramChatId({ organizationId: "org-1", eventChatId: " -100-event " })).resolves.toBe("-100-event");

    selectMock.mockReturnValue(selectChain([{ organizationId: "org-1", chatId: " -100-global ", enabled: true }]));
    await expect(resolveTelegramChatId({ organizationId: "org-1" })).resolves.toBe("-100-global");

    selectMock.mockReturnValue(selectChain([{ organizationId: "org-1", chatId: "-100-global", enabled: false }]));
    await expect(resolveTelegramChatId({ organizationId: "org-1" })).resolves.toBeUndefined();
  });

  it("prefers an event template and falls back to the organization template", async () => {
    await expect(resolveTelegramMessageTemplate({ organizationId: "org-1", eventTemplate: "{{nombre}}" })).resolves.toBe("{{nombre}}");

    selectMock.mockReturnValue(selectChain([{ organizationId: "org-1", messageTemplate: "{{evento}}" }]));
    await expect(resolveTelegramMessageTemplate({ organizationId: "org-1" })).resolves.toBe("{{evento}}");
  });
});
