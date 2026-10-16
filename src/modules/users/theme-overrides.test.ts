import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, insertMock, deleteMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { select: selectMock, insert: insertMock, delete: deleteMock },
}));

vi.mock("./db", () => ({
  themeColorOverrides: {
    themeId: "theme_id",
    token: "token",
    hex: "hex",
    updatedAt: "updated_at",
    updatedBy: "updated_by",
  },
}));

import {
  getThemeColorOverrides,
  setThemeColorOverride,
  clearThemeColorOverride,
  buildThemeOverrideStyle,
} from "./theme-overrides";

function selectChain(rows: unknown[]) {
  const chain = { from: vi.fn() };
  chain.from.mockResolvedValue(rows);
  return chain;
}

function insertChain() {
  const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockResolvedValue(undefined);
  return chain;
}

function deleteChain() {
  const chain = { where: vi.fn() };
  chain.where.mockResolvedValue(undefined);
  return chain;
}

describe("theme-overrides", () => {
  beforeEach(() => {
    selectMock.mockReset();
    insertMock.mockReset();
    deleteMock.mockReset();
  });

  describe("getThemeColorOverrides", () => {
    it("groups override rows by themeId", async () => {
      selectMock.mockReturnValue(
        selectChain([
          { themeId: "arctic-frost", token: "primary", hex: "#111111" },
          { themeId: "arctic-frost", token: "accent", hex: "#222222" },
          { themeId: "midnight", token: "background", hex: "#333333" },
        ]),
      );

      const result = await getThemeColorOverrides();

      expect(result).toEqual({
        "arctic-frost": { primary: "#111111", accent: "#222222" },
        midnight: { background: "#333333" },
      });
    });

    it("returns an empty object when there are no overrides", async () => {
      selectMock.mockReturnValue(selectChain([]));
      expect(await getThemeColorOverrides()).toEqual({});
    });
  });

  describe("setThemeColorOverride", () => {
    const baseInput = { themeId: "arctic-frost", token: "primary" as const, hex: "#3772ff", actorUserId: "user-1" };

    it("rejects a non-ADMIN actor without touching the DB", async () => {
      const result = await setThemeColorOverride({ ...baseInput, actorRole: "MARKETING_USER" });
      expect(result).toEqual({ ok: false, reason: "forbidden" });
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("rejects an invalid hex value without touching the DB", async () => {
      const result = await setThemeColorOverride({ ...baseInput, actorRole: "ADMIN", hex: "not-a-hex" });
      expect(result).toEqual({ ok: false, reason: "invalid_hex" });
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("rejects a 3-digit shorthand hex (only #rrggbb is accepted)", async () => {
      const result = await setThemeColorOverride({ ...baseInput, actorRole: "ADMIN", hex: "#fff" });
      expect(result).toEqual({ ok: false, reason: "invalid_hex" });
    });

    it("upserts for an ADMIN actor with a valid hex", async () => {
      const chain = insertChain();
      insertMock.mockReturnValue(chain);

      const result = await setThemeColorOverride({ ...baseInput, actorRole: "ADMIN" });

      expect(result).toEqual({ ok: true });
      expect(insertMock).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ themeId: "arctic-frost", token: "primary", hex: "#3772ff", updatedBy: "user-1" }),
      );
      expect(chain.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe("clearThemeColorOverride", () => {
    it("rejects a non-ADMIN actor without touching the DB", async () => {
      const result = await clearThemeColorOverride({
        actorRole: "MARKETING_USER",
        themeId: "arctic-frost",
        token: "primary",
      });
      expect(result).toEqual({ ok: false, reason: "forbidden" });
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it("deletes the override row for an ADMIN actor", async () => {
      const chain = deleteChain();
      deleteMock.mockReturnValue(chain);

      const result = await clearThemeColorOverride({
        actorRole: "ADMIN",
        themeId: "arctic-frost",
        token: "primary",
      });

      expect(result).toEqual({ ok: true });
      expect(deleteMock).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });
  });

  describe("buildThemeOverrideStyle", () => {
    it("returns an empty string when there is nothing to override", () => {
      expect(buildThemeOverrideStyle(undefined)).toBe("");
      expect(buildThemeOverrideStyle({})).toBe("");
    });

    it("emits one CSS custom property declaration per overridden token", () => {
      expect(buildThemeOverrideStyle({ primary: "#111111", background: "#faf8f2" })).toBe(
        "--primary:#111111;--background:#faf8f2;",
      );
    });

    it("emits every token when all three are overridden", () => {
      const style = buildThemeOverrideStyle({ primary: "#111111", accent: "#222222", background: "#333333" });
      expect(style).toBe("--primary:#111111;--accent:#222222;--background:#333333;");
    });
  });
});
