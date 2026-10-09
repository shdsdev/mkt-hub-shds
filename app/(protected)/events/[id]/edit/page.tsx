import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEvent } from "@/modules/events";
import { EventEditForm } from "./event-edit-form";

// ADMIN-only, same gate as app/(protected)/events/page.tsx.
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">{event.name}</h1>
        <p className="text-sm text-muted-foreground">Estado actual: {event.status}</p>
      </div>

      <EventEditForm event={event} />
    </div>
  );
}
