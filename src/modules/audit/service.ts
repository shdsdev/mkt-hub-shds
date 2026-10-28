import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs } from "./db";
import { createRateLimiter } from "./rate-limit";

export type AuditLog = typeof auditLogs.$inferSelect;
export type AuditAction = AuditLog["action"];

export type RecordAuditInput = {
  organizationId: string;
  userId?: string;
  actorType?: "user" | "system";
  eventId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
};

// Called directly from mutating server actions after the module-level mutation succeeds — keeps
// "what counts as an auditable user action" a UI-layer decision (design doc §Audit_logs).
export async function recordAudit(input: RecordAuditInput): Promise<AuditLog> {
  const [entry] = await db
    .insert(auditLogs)
    .values({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      actorType: input.actorType ?? "user",
      eventId: input.eventId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      before: input.before ?? null,
      after: input.after ?? null,
    })
    .returning();
  return entry;
}

export async function listAuditLogs(organizationId: string): Promise<AuditLog[]> {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt));
}

export async function listEventAuditLogs(input: {
  organizationId: string;
  eventId: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLog[]> {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.organizationId, input.organizationId), eq(auditLogs.eventId, input.eventId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

// Single shared limiter instance — reused across every mutating server action (design doc
// §Rate_Limiting). In-memory state, valid because the deployment is one persistent container.
const mutationRateLimiter = createRateLimiter({ maxActions: 30, windowMs: 60_000 });
const hcsRaffleResendRateLimiter = createRateLimiter({ maxActions: 5, windowMs: 60_000 });

export function checkRateLimit(userId: string): boolean {
  return mutationRateLimiter.check(userId);
}

export function checkHcsRaffleResendRateLimit(connectionId: string, actorId: string): boolean {
  return hcsRaffleResendRateLimiter.check(`hcs-raffle-resend:${connectionId}:${actorId}`);
}
