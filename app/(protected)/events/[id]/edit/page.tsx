import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin, listManagedUsers } from "@/modules/users";
import { getEvent, getEventEmbedSnippet, getEventEmbedUrl, getEventLandingUrl, listEventReceptionistIds, resolveRegistrationFormConfig } from "@/modules/events";
import { env } from "@/lib/env";
import { EventEditForm } from "./event-edit-form";
import { EventSubNav } from "../../event-sub-nav";
import { LandingLink } from "./landing-link";
import { ReceptionTeam } from "./reception-team";

// ADMIN-only, same gate as app/(protected)/events/page.tsx.
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  const [managedUsers, assignedReceptionistIds] = await Promise.all([
    listManagedUsers(user.profile.organizationId),
    listEventReceptionistIds(event.id, user.profile.organizationId),
  ]);
  const embedUrl = getEventEmbedUrl(env.NEXT_PUBLIC_APP_ORIGIN, event.slug);
  const embedSnippet = getEventEmbedSnippet(env.NEXT_PUBLIC_APP_ORIGIN, event.slug);
  const landingUrl = getEventLandingUrl(env.NEXT_PUBLIC_APP_ORIGIN, event.slug);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">{event.name}</h1>
        <p className="text-sm text-muted-foreground">Estado actual: {event.status}</p>
      </div>

      <LandingLink landingUrl={landingUrl} />

      <EventSubNav eventId={event.id} current="edit" />

      <EventEditForm
        event={event}
        formConfig={resolveRegistrationFormConfig(event)}
        embedUrl={embedUrl}
        embedSnippet={embedSnippet}
      />
      <ReceptionTeam
        eventId={event.id}
        users={managedUsers.filter((managedUser) => managedUser.role === "RECEPTION")}
        assignedIds={assignedReceptionistIds}
      />
    </div>
  );
}
