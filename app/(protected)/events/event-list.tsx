"use client";

import { useState } from "react";
import type { EventRow } from "@/modules/events";
import type { UserRole } from "@/modules/users";
import { EventCard } from "./event-card";

export function EventList({ events, role = "ADMIN" }: { events: EventRow[]; role?: UserRole }) {
  const [showArchived, setShowArchived] = useState(false);
  const visibleEvents = events.filter((event) => showArchived ? event.status === "archived" : event.status !== "archived");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1" role="tablist" aria-label="Filtrar eventos">
        <button type="button" role="tab" aria-selected={!showArchived} className="rounded-md px-3 py-1.5 text-sm font-medium aria-selected:bg-background aria-selected:shadow-sm" onClick={() => setShowArchived(false)}>Todos</button>
        <button type="button" role="tab" aria-selected={showArchived} className="rounded-md px-3 py-1.5 text-sm font-medium aria-selected:bg-background aria-selected:shadow-sm" onClick={() => setShowArchived(true)}>Archivados</button>
      </div>
      {visibleEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{showArchived ? "No hay eventos archivados." : "Todavía no hay eventos."}</p>
      ) : (
        <div className="grid gap-4">{visibleEvents.map((event) => <EventCard key={event.id} event={event} role={role} />)}</div>
      )}
    </div>
  );
}
