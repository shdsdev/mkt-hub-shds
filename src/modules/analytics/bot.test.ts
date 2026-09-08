import { describe, it, expect } from "vitest";
import { isKnownBot } from "./bot";

describe("isKnownBot", () => {
  it("flags known social/chat preview crawlers", () => {
    expect(isKnownBot("WhatsApp/2.23.20.0")).toBe(true);
    expect(isKnownBot("facebookexternalhit/1.1")).toBe(true);
    expect(isKnownBot("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isKnownBot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isKnownBot("Mozilla/5.0 (compatible; Discordbot/2.0)")).toBe(true);
    expect(isKnownBot("LinkedInBot/1.0")).toBe(true);
  });

  it("flags common search engine bots", () => {
    expect(isKnownBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isKnownBot("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
  });

  it("does not flag a normal browser UA", () => {
    expect(
      isKnownBot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("does not flag a missing/empty user agent as a false negative crash — treats it as not a known bot", () => {
    expect(isKnownBot(undefined)).toBe(false);
    expect(isKnownBot("")).toBe(false);
  });

  it("matching is case-insensitive", () => {
    expect(isKnownBot("whatsapp/2.0")).toBe(true);
  });
});
