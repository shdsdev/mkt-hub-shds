import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, getEvent, listChecklistTemplates, listEventAssignees, listEventChecklist, listEventChecklistComments } from "@/modules/events";
import { isActive } from "@/modules/users";
import { EventSubNav } from "../../event-sub-nav";
import { OrganizationChecklist } from "./organization-checklist";

export default async function EventOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "organization" }))) notFound();

  const canEdit = user.profile.role === "ADMIN" || user.profile.role === "EVENT_EDITOR";
  const [groups, assignees, templates, comments] = await Promise.all([
    listEventChecklist(event.id, user.profile.organizationId),
    listEventAssignees(event.id, user.profile.organizationId),
    canEdit ? listChecklistTemplates(user.profile.organizationId) : Promise.resolve([]),
    listEventChecklistComments(event.id, user.profile.organizationId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <EventSubNav eventId={event.id} current="organization" role={user.profile.role} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-10">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Organización: {event.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Planificá el trabajo del equipo y seguí el avance del evento.</p>
        </div>
        <OrganizationChecklist eventId={event.id} groups={groups} assignees={assignees} templates={templates} comments={comments} canEdit={canEdit} currentUserId={user.id} />
      </div>
    </div>
  );
}
