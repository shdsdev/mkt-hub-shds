import { getCurrentUser } from "@/modules/auth";
import { listAuditLogs } from "@/modules/audit";
import { getEmailByUserId } from "@/modules/users";
import { AuditLogTable, type AuditLogRow } from "./audit-log-table";

export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const logs = await listAuditLogs(user.profile.organizationId);

  const emailsByUserId = new Map<string, string>();
  for (const userId of new Set(logs.map((log) => log.userId))) {
    emailsByUserId.set(userId, (await getEmailByUserId(userId)) ?? "Unknown");
  }

  const rows: AuditLogRow[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    resourceType: log.resourceType,
    who: emailsByUserId.get(log.userId) ?? "Unknown",
    when: log.createdAt.toLocaleString(),
    before: log.before,
    after: log.after,
  }));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          A record of every mutating action taken in this organization. Click a row with a diff to
          expand its before/after values.
        </p>
      </div>

      <AuditLogTable logs={rows} />
    </div>
  );
}
