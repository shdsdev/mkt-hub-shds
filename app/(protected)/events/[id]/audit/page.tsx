import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getCurrentUser } from "@/modules/auth";
import { getEmailByUserId, isActive } from "@/modules/users";
import { canAccessEvent, getEvent } from "@/modules/events";
import { listEventAuditLogs } from "@/modules/audit";
import { EventSubNav } from "../../event-sub-nav";
import { EventAuditLogTable, type EventAuditLogRow } from "./event-audit-log-table";

export default async function EventAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  const canView = await canAccessEvent({
    userId: user.id,
    organizationId: user.profile.organizationId,
    role: user.profile.role,
    eventId: id,
    capability: "audit",
  });
  if (!canView) notFound();

  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  const logs = await listEventAuditLogs({ organizationId: user.profile.organizationId, eventId: id });
  const userIds = [...new Set(logs.flatMap((log) => log.userId ? [log.userId] : []))];
  const emails = new Map<string, string>();
  await Promise.all(userIds.map(async (userId) => emails.set(userId, (await getEmailByUserId(userId)) ?? "Usuario desconocido")));

  const rows: EventAuditLogRow[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    resourceType: log.resourceType,
    actor: log.userId ? emails.get(log.userId) ?? "Usuario desconocido" : "Sistema",
    actorType: log.actorType,
    when: log.createdAt.toLocaleString(),
    dateKey: format(log.createdAt, "yyyy-MM-dd"),
    before: log.before,
    after: log.after,
  }));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <EventSubNav eventId={event.id} current="audit" role={user.profile.role} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Trazabilidad del evento</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Historial: {event.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Cambios, envíos y acciones automáticas realizadas sobre este evento. Los detalles sensibles se omiten.</p>
        </div>
        <EventAuditLogTable logs={rows} />
      </div>
    </div>
  );
}
