import { describe, expect, it } from "vitest";
import { createRaffleStageToken, hashRaffleStageToken } from "./tokens";

describe("raffle stage tokens", () => {
  it("creates an opaque token and a deterministic hash", () => {
    const token = createRaffleStageToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashRaffleStageToken(token)).toHaveLength(64);
    expect(hashRaffleStageToken(token)).toBe(hashRaffleStageToken(token));
  });

  it("does not produce the same token twice", () => {
    expect(createRaffleStageToken()).not.toBe(createRaffleStageToken());
  });
});
