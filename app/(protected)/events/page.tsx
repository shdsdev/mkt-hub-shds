import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { listEvents } from "@/modules/events";
import { EventCreateForm } from "./event-create-form";

// ADMIN-only (spec.md "ADMIN-Only Event Authoring") — same notFound gate as
// app/(protected)/settings/users/page.tsx and app/(protected)/admin/page.tsx.
export default async function EventsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const events = await listEvents(user.profile.organizationId);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Eventos</h1>
        <p className="text-sm text-muted-foreground">
          Crea y administra eventos. Solo un evento publicado es visible en su página pública.
        </p>
      </div>

      <EventCreateForm />

      <div className="flex flex-col gap-2">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay eventos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Nombre</th>
                <th className="py-2">Slug</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Inicio</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-border">
                  <td className="py-2">{event.name}</td>
                  <td className="py-2 text-muted-foreground">{event.slug}</td>
                  <td className="py-2">{event.status}</td>
                  <td className="py-2 text-muted-foreground">
                    {event.startsAt.toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    <Link href={`/events/${event.id}/edit`} className="text-primary underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
