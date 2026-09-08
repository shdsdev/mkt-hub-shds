// Sole schema entry drizzle-kit reads. Barrel-exports every module's db.ts.
// Sanctioned exception to ARCHITECTURE.md I-4 — see eslint.config.mjs boundaries/db-barrel rule.
export * from "@/modules/auth/db";
export * from "@/modules/users/db";
export * from "@/modules/links/db";
export * from "@/modules/redirects/db";
export * from "@/modules/qr/db";
export * from "@/modules/utm/db";
export * from "@/modules/campaigns/db";
export * from "@/modules/analytics/db";
export * from "@/modules/integrations/db";
export * from "@/modules/audit/db";
