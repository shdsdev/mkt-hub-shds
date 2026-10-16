import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  raffleStatus,
  raffleWinnerPolicy,
  raffleDrawStatus,
  raffleAuditAction,
  raffles,
  rafflePrizes,
  raffleDraws,
  raffleAudit,
} from "./db";

describe("raffles schema", () => {
  it("defines the raffle, winner, draw, and audit enums", () => {
    expect(raffleStatus.enumValues).toEqual(["not_configured", "ready", "active", "finished", "paused"]);
    expect(raffleWinnerPolicy.enumValues).toEqual(["include_winners", "exclude_winners"]);
    expect(raffleDrawStatus.enumValues).toEqual(["pending_reveal", "revealed", "claimed", "unclaimed", "invalidated"]);
    expect(raffleAuditAction.enumValues).toEqual([
      "draw",
      "reveal",
      "claim",
      "invalidate",
      "validate",
      "resend_request",
      "prize_change",
      "status_change",
    ]);
  });

  it("scopes every raffle table to an organization and preserves one raffle per event", () => {
    for (const table of [raffles, rafflePrizes, raffleDraws, raffleAudit]) {
      expect(table.organizationId.notNull).toBe(true);
    }
    const { indexes } = getTableConfig(raffles);
    expect(indexes.find((index) => index.config.name === "raffles_event_unique")?.config.unique).toBe(true);
  });

  it("stores draw eligibility and winner snapshots", () => {
    expect(raffleDraws.eligibleAttendeeIds.notNull).toBe(true);
    expect(raffleDraws.eligibleCount.notNull).toBe(true);
    expect(raffleDraws.attendeeName.notNull).toBe(true);
    expect(raffleDraws.attendeeEmail.notNull).toBe(true);
    expect(raffleDraws.attendeeCode.notNull).toBe(true);
  });

  it("defines positive quantity and bounded drawn quantity checks", () => {
    const { checks } = getTableConfig(rafflePrizes);
    expect(checks.map((check) => check.name)).toEqual([
      "raffle_prizes_quantity_positive",
      "raffle_prizes_drawn_quantity_valid",
    ]);
  });
});
