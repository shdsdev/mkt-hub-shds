"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ManagedUser } from "@/modules/users";
import {
  changeUserRoleAction,
  disableUserAction,
  inviteUserAction,
  reactivateUserAction,
  type UserManagementFormState,
} from "./actions";

const initialState: UserManagementFormState = {};

function roleLabel(role: ManagedUser["role"]): "ADMIN" | "User" | undefined {
  if (role === "ADMIN") return "ADMIN";
  if (role === "MARKETING_USER") return "User";
}

export function UserManagement({ users }: { users: ManagedUser[] }) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteUserAction, initialState);
  const [roleState, roleAction, rolePending] = useActionState(changeUserRoleAction, initialState);
  const [disableState, disableAction, disablePending] = useActionState(disableUserAction, initialState);
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(
    reactivateUserAction,
    initialState,
  );
  const managedUsers = users.filter((user) => roleLabel(user.role));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">Administra el acceso de tu organización.</p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="font-heading font-medium">Invitar usuario</h2>
          <p className="text-xs text-muted-foreground">Envía una invitación con el rol seleccionado.</p>
        </div>
        <form action={inviteAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Correo electrónico
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Rol
            <Select name="role" defaultValue="User">
              <SelectTrigger aria-label="Rol para la invitación" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <Button type="submit" disabled={invitePending}>
            Invitar usuario
          </Button>
        </form>
        {(inviteState.error || inviteState.success) && (
          <p role={inviteState.error ? "alert" : "status"} className="text-sm text-muted-foreground">
            {inviteState.error ?? inviteState.success}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading font-medium">Usuarios de la organización</h2>
          <p className="text-xs text-muted-foreground">Roles y estado de acceso actuales.</p>
        </div>
        <ul className="flex flex-col gap-3">
          {managedUsers.map((user) => {
            const role = roleLabel(user.role);
            if (!role) return null;

            return (
              <li key={user.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {role} · {user.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={roleAction} className="flex items-center gap-2">
                    <input type="hidden" name="targetUserId" value={user.id} />
                    <Select name="role" defaultValue={role}>
                      <SelectTrigger aria-label={`Rol de ${user.email}`} className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                          <SelectItem value="User">User</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button type="submit" variant="outline" size="sm" disabled={rolePending}>
                      Guardar rol
                    </Button>
                  </form>
                  {user.status === "active" ? (
                    <form action={disableAction}>
                      <input type="hidden" name="targetUserId" value={user.id} />
                      <Button type="submit" variant="destructive" size="sm" disabled={disablePending}>
                        Deshabilitar
                      </Button>
                    </form>
                  ) : (
                    <form action={reactivateAction}>
                      <input type="hidden" name="targetUserId" value={user.id} />
                      <Button type="submit" variant="outline" size="sm" disabled={reactivatePending}>
                        Reactivar
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {managedUsers.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay usuarios para administrar.</p>
        )}
        {(roleState.error || roleState.success) && (
          <p role={roleState.error ? "alert" : "status"} className="text-sm text-muted-foreground">
            {roleState.error ?? roleState.success}
          </p>
        )}
        {(disableState.error || disableState.success) && (
          <p role={disableState.error ? "alert" : "status"} className="text-sm text-muted-foreground">
            {disableState.error ?? disableState.success}
          </p>
        )}
        {(reactivateState.error || reactivateState.success) && (
          <p role={reactivateState.error ? "alert" : "status"} className="text-sm text-muted-foreground">
            {reactivateState.error ?? reactivateState.success}
          </p>
        )}
      </section>
    </div>
  );
}
