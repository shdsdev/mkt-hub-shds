import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getDefaultRegistrationFormConfig, listAccessibleEvents } from "@/modules/events";
import { EventCreateForm } from "./event-create-form";
import { EventList } from "./event-list";

export default async function EventsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !["ADMIN", "EVENT_EDITOR", "RECEPTION"].includes(user.profile.role)) notFound();

  const events = await listAccessibleEvents({
    organizationId: user.profile.organizationId,
    userId: user.id,
    role: user.profile.role,
    includeArchived: true,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-heading text-xl font-semibold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin(user.profile)
              ? "Crea y administra eventos. Solo un evento publicado es visible en su página pública."
              : "Administra los eventos que te asignó un administrador."}
          </p>
        </div>
        {isAdmin(user.profile) && (
          <EventCreateForm
            initialFormConfig={getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false })}
          />
        )}
      </div>

      <EventList events={events} role={user.profile.role} />
    </div>
  );
}
