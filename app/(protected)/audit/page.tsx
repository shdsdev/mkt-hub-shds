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
    emailsByUserId.set(userId, (await getEmailByUserId(userId)) ?? "Desconocido");
  }

  const rows: AuditLogRow[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    resourceType: log.resourceType,
    who: emailsByUserId.get(log.userId) ?? "Desconocido",
    when: log.createdAt.toLocaleString(),
    before: log.before,
    after: log.after,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Registro de auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Un registro de cada acción que modifica datos en esta organización. Haz clic en una
          fila con cambios para expandir sus valores antes/después.
        </p>
      </div>

      <AuditLogTable logs={rows} />
    </div>
  );
}
