import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEvent } from "@/modules/events";
import { CheckInForm } from "./check-in-form";
import { EventSubNav } from "../../event-sub-nav";

// design.md RBAC: "check-in needs any active session ... no new role" — unlike
// app/(protected)/events/[id]/edit/page.tsx, there is deliberately no isAdmin gate here.
export default async function EventCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      {/* Only ADMIN sees the cross-links (Editar/Registros/Resultados are ADMIN-only pages) —
          door staff on a plain active session would just hit notFound() on those. */}
      {isAdmin(user.profile) ? <EventSubNav eventId={event.id} current="check-in" /> : null}
      <div>
        <h1 className="font-heading text-xl font-semibold">Check-in: {event.name}</h1>
        <p className="text-sm text-muted-foreground">
          Escanea el pase del asistente o escribe su código de respaldo.
        </p>
      </div>
      <CheckInForm eventId={event.id} />
    </div>
  );
}
