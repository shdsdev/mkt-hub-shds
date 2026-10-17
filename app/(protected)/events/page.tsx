import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getDefaultRegistrationFormConfig, listEvents } from "@/modules/events";
import { EventCreateForm } from "./event-create-form";
import { EventList } from "./event-list";

// ADMIN-only (spec.md "ADMIN-Only Event Authoring") — same notFound gate as
// app/(protected)/settings/users/page.tsx and app/(protected)/admin/page.tsx.
export default async function EventsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const events = await listEvents(user.profile.organizationId, { includeArchived: true });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-heading text-xl font-semibold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            Crea y administra eventos. Solo un evento publicado es visible en su página pública.
          </p>
        </div>
        <EventCreateForm
          initialFormConfig={getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false })}
        />
      </div>

      <EventList events={events} />
    </div>
  );
}
