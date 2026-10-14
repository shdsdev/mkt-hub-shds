"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ManagedUser } from "@/modules/users";
import { assignReceptionistAction, removeReceptionistAction, type ReceptionTeamState } from "./reception-team-actions";

const initialState: ReceptionTeamState = {};

export function ReceptionTeam({ eventId, users, assignedIds }: { eventId: string; users: ManagedUser[]; assignedIds: string[] }) {
  const [assignState, assignAction, assignPending] = useActionState(assignReceptionistAction, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeReceptionistAction, initialState);
  const assigned = users.filter((user) => assignedIds.includes(user.id));
  const available = users.filter((user) => !assignedIds.includes(user.id) && user.status === "active");

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-heading font-medium">Equipo de recepción</h2>
        <p className="text-xs text-muted-foreground">Asigna usuarios con rol Recepción a este evento.</p>
      </div>
      {available.length > 0 ? (
        <form action={assignAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="eventId" value={eventId} />
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Usuario
            <Select name="userId" required>
              <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
              <SelectContent>
                {available.map((user) => <SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <Button type="submit" disabled={assignPending}>{assignPending ? "Asignando…" : "Asignar"}</Button>
        </form>
      ) : null}
      <ul className="flex flex-col gap-2">
        {assigned.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
            <span>{user.email}</span>
            <form action={removeAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="userId" value={user.id} />
              <Button type="submit" variant="outline" size="sm" disabled={removePending}>Quitar</Button>
            </form>
          </li>
        ))}
      </ul>
      {assigned.length === 0 ? <p className="text-sm text-muted-foreground">No hay usuarios asignados.</p> : null}
      {(assignState.error || assignState.success || removeState.error || removeState.success) ? (
        <p role={(assignState.error || removeState.error) ? "alert" : "status"} className="text-sm text-muted-foreground">
          {assignState.error ?? assignState.success ?? removeState.error ?? removeState.success}
        </p>
      ) : null}
    </section>
  );
}
