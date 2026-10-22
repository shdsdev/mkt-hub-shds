import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin, listManagedUsers } from "@/modules/users";
import { canAccessEvent, getEvent, getEventEmbedSnippet, getEventEmbedUrl, getEventLandingUrl, listEventEditorIds, listEventReceptionistIds, resolveRegistrationFormConfig } from "@/modules/events";
import { env } from "@/lib/env";
import { EventEditForm } from "./event-edit-form";
import { EventSubNav } from "../../event-sub-nav";
import { LandingLink } from "./landing-link";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: id, capability: "edit" }))) notFound();
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  const [managedUsers, assignedReceptionistIds, assignedEditorIds] = await Promise.all([
    listManagedUsers(user.profile.organizationId),
    listEventReceptionistIds(event.id, user.profile.organizationId),
    listEventEditorIds(event.id, user.profile.organizationId),
  ]);
  const embedUrl = getEventEmbedUrl(env.NEXT_PUBLIC_APP_ORIGIN, event.slug);
  const embedSnippet = getEventEmbedSnippet(env.NEXT_PUBLIC_APP_ORIGIN, event.slug);
  const landingUrl = getEventLandingUrl(env.NEXT_PUBLIC_APP_ORIGIN, event.slug);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <EventSubNav eventId={event.id} current="edit" role={user.profile.role} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div>
          <h1 className="font-heading text-xl font-semibold">{event.name}</h1>
          <p className="text-sm text-muted-foreground">Estado actual: {event.status}</p>
        </div>

        <LandingLink landingUrl={landingUrl} />

          <EventEditForm
          event={event}
          formConfig={resolveRegistrationFormConfig(event)}
          embedUrl={embedUrl}
          embedSnippet={embedSnippet}
          receptionUsers={managedUsers.filter((managedUser) => managedUser.role === "RECEPTION")}
          assignedReceptionistIds={assignedReceptionistIds}
          editorUsers={managedUsers.filter((managedUser) => managedUser.role === "EVENT_EDITOR")}
          assignedEditorIds={assignedEditorIds}
          canManageTeam={isAdmin(user.profile)}
        />
      </div>
    </div>
  );
}
