import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, getEvent } from "@/modules/events";
import { isActive } from "@/modules/users";
import { EventSubNav } from "../../event-sub-nav";

export default async function InternalEventFormPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();
  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "internal-form" }))) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <EventSubNav eventId={event.id} current="internal-form" role={user.profile.role} />
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Formulario interno: {event.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administración de registros y acompañantes.</p>
      </div>
    </div>
  );
}
