import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEvent } from "@/modules/events";
import { EventEditForm } from "./event-edit-form";
import { EventSubNav } from "../../event-sub-nav";

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

      <EventSubNav eventId={event.id} current="edit" />

      {/* Keyed by updatedAt: after a save, revalidatePath re-fetches a fresh `event` object and
          re-renders this same mounted form with new defaultValue props on its (uncontrolled)
          inputs — Base UI warns ("changing the default value state of an uncontrolled
          FieldControl after being initialized") because that's ambiguous once a field has its
          own uncontrolled state. The key forces React to treat a genuinely changed event as a new
          form instance (remount), instead of re-initializing already-mounted inputs. */}
      <EventEditForm key={`${event.id}:${event.updatedAt.getTime()}`} event={event} />
    </div>
  );
}
