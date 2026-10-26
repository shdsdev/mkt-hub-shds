"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ManagedUser, Theme } from "@/modules/users";
import {
  changeUserRoleAction,
  deleteUserAction,
  disableUserAction,
  inviteUserAction,
  reactivateUserAction,
  sendPasswordSetupLinkAction,
  setUserThemeAction,
  type UserManagementFormState,
} from "./actions";

const ITEMS_PER_PAGE = 6;
const initialState: UserManagementFormState = {};

type RoleValue = "ADMIN" | "User" | "Reception" | "EventEditor";

function roleLabel(role: ManagedUser["role"]): RoleValue | undefined {
  if (role === "ADMIN") return "ADMIN";
  if (role === "MARKETING_USER") return "User";
  if (role === "RECEPTION") return "Reception";
  if (role === "EVENT_EDITOR") return "EventEditor";
}

function getInitials(email: string): string {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatJoinedDate(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(value);
}

export function UserManagement({ users, themes = [] }: { users: ManagedUser[]; themes?: Theme[] }) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteUserAction, initialState);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return users.filter((user) => {
      const role = roleLabel(user.role);
      if (!role) return false;
      const matchesSearch = !normalizedSearch || user.email.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, pageCount);
  const currentUsers = filteredUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  function updateSearch(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setCurrentPage(1);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
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
              <SelectTrigger aria-label="Rol para la invitación" className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Reception">Recepción</SelectItem>
                  <SelectItem value="EventEditor">Editor de Eventos</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <Button type="submit" disabled={invitePending}>
            {invitePending ? "Enviando…" : "Invitar usuario"}
          </Button>
        </form>
        {(inviteState.error || inviteState.success) && (
          <p role={inviteState.error ? "alert" : "status"} className="text-sm text-muted-foreground">
            {inviteState.error ?? inviteState.success}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading font-medium">Usuarios de la organización</h2>
            <p className="text-xs text-muted-foreground">Roles y estado de acceso actuales.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" data-icon="inline-start" />
              <Input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Buscar usuarios…"
                aria-label="Buscar usuarios"
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value) => updateFilter(setRoleFilter, value ?? "all")}>
              <SelectTrigger aria-label="Filtrar por rol" className="w-full sm:w-40">
                <SelectValue placeholder="Todos los roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Reception">Recepción</SelectItem>
                  <SelectItem value="EventEditor">Editor de Eventos</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => updateFilter(setStatusFilter, value ?? "all")}>
              <SelectTrigger aria-label="Filtrar por estado" className="w-full sm:w-36">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="disabled">Bloqueados</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-full min-w-0">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col />
              <col className="w-64" />
               <col className="w-40" />
               <col className="w-24" />
              <col className="w-36" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-4 font-medium uppercase tracking-wider text-muted-foreground">Usuario</th>
                <th className="p-4 font-medium uppercase tracking-wider text-muted-foreground">Rol</th>
                <th className="p-4 font-medium uppercase tracking-wider text-muted-foreground">Tema</th>
                <th className="p-4 font-medium uppercase tracking-wider text-muted-foreground">Alta</th>
                <th className="p-4 text-right font-medium uppercase tracking-wider text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
               {currentUsers.map((user) => <ManagedUserRow key={user.id} user={user} themes={themes} />)}
            </tbody>
          </table>
        </div>

        {currentUsers.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No hay usuarios que coincidan con los filtros.</p>
        )}

        <div className="flex items-center justify-between border-t border-border p-4 text-sm text-muted-foreground">
          <span>{filteredUsers.length} usuario{filteredUsers.length === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <span>Página {page} de {pageCount}</span>
            <Button type="button" variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft data-icon="inline-start" />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}>
              <ChevronRight data-icon="inline-start" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ManagedUserRow({ user, themes }: { user: ManagedUser; themes: Theme[] }) {
  const role = roleLabel(user.role) ?? "User";
  const roleFormRef = useRef<HTMLFormElement>(null);
  const [roleState, roleAction, rolePending] = useActionState(changeUserRoleAction, initialState);
  const themeFormRef = useRef<HTMLFormElement>(null);
  const [themeState, themeAction, themePending] = useActionState(setUserThemeAction, initialState);
  const [statusState, statusAction, statusPending] = useActionState(
    user.status === "active" ? disableUserAction : reactivateUserAction,
    initialState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(sendPasswordSetupLinkAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteUserAction, initialState);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deleteConfirmationOpen) return;

    deleteDialogRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDeleteConfirmationOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteConfirmationOpen]);

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
      <td className="min-w-0 p-4">
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="bg-primary/10 text-primary">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">{getInitials(user.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{user.email.split("@")[0]}</div>
            <div className="truncate text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="p-4 align-middle">
        <form ref={roleFormRef} action={roleAction}>
          <input type="hidden" name="targetUserId" value={user.id} />
          <Select
            name="role"
            defaultValue={role}
            onValueChange={(value) => {
              if (value !== role) roleFormRef.current?.requestSubmit();
            }}
          >
            <SelectTrigger aria-label={`Rol de ${user.email}`} className="w-full max-w-52" disabled={rolePending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ADMIN">ADMIN</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Reception">Recepción</SelectItem>
                <SelectItem value="EventEditor">Editor de Eventos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </form>
      </td>
      <td className="p-4 align-middle">
        <form ref={themeFormRef} action={themeAction}>
          <input type="hidden" name="targetUserId" value={user.id} />
          <Select name="theme" defaultValue={user.theme ?? "light"} onValueChange={(value) => { if (value && value !== (user.theme ?? "light")) themeFormRef.current?.requestSubmit(); }}>
            <SelectTrigger aria-label={`Tema de ${user.email}`} className="w-full max-w-36" disabled={themePending}><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{themes.map((theme) => <SelectItem key={theme.id} value={theme.id}>{theme.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </form>
      </td>
      <td className="p-4 text-sm text-muted-foreground">{formatJoinedDate(user.createdAt)}</td>
      <td className="p-4 text-right align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" />}>
            Acciones <ChevronDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              {user.status === "active" && (
                <form action={passwordAction}>
                  <input type="hidden" name="targetUserId" value={user.id} />
                  <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" disabled={passwordPending} />}>
                    {passwordPending ? "Enviando…" : "Reenviar enlace"}
                  </DropdownMenuItem>
                </form>
              )}
              <form action={statusAction}>
                <input type="hidden" name="targetUserId" value={user.id} />
                <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" disabled={statusPending} />}>
                  {statusPending ? "Guardando…" : user.status === "active" ? "Bloquear usuario" : "Desbloquear usuario"}
                </DropdownMenuItem>
              </form>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              nativeButton
              render={<button type="button" className="w-full" disabled={deletePending} />}
              onClick={() => setDeleteConfirmationOpen(true)}
            >
              Eliminar definitivamente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {(roleState.error || themeState.error || passwordState.error || statusState.error || deleteState.error) && (
          <p role="alert" className="mt-2 max-w-52 text-xs text-destructive">
            {roleState.error ?? themeState.error ?? passwordState.error ?? statusState.error ?? deleteState.error}
          </p>
        )}
        {deleteConfirmationOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDeleteConfirmationOpen(false);
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`delete-user-title-${user.id}`}
              aria-describedby={`delete-user-description-${user.id}`}
              ref={deleteDialogRef}
              tabIndex={-1}
              className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-left shadow-2xl"
            >
              <h2 id={`delete-user-title-${user.id}`} className="font-heading text-lg font-semibold">
                Confirmar eliminación
              </h2>
              <p id={`delete-user-description-${user.id}`} className="mt-2 text-sm text-muted-foreground">
                Se eliminará definitivamente la cuenta de {user.email} y todos sus datos relacionados. Esta acción no se puede deshacer.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDeleteConfirmationOpen(false)} disabled={deletePending}>
                  Cancelar
                </Button>
                <form
                  action={deleteAction}
                  onSubmit={() => setDeleteConfirmationOpen(false)}
                >
                  <input type="hidden" name="targetUserId" value={user.id} />
                  <Button type="submit" variant="destructive" disabled={deletePending}>
                    {deletePending ? "Eliminando…" : "Eliminar definitivamente"}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
