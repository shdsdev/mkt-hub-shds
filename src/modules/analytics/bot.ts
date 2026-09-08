// UA-list matching for known preview crawlers and search bots (SPEC.md §21). Flags, never drops
// (I-8) — is_bot lets dashboards exclude these from "unique" counts while keeping the row.
const KNOWN_BOT_PATTERNS = [
  "whatsapp",
  "facebookexternalhit",
  "slackbot",
  "telegrambot",
  "twitterbot",
  "discordbot",
  "linkedinbot",
  "pinterest",
  "googlebot",
  "bingbot",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
];

export function isKnownBot(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return KNOWN_BOT_PATTERNS.some((pattern) => lower.includes(pattern));
}
