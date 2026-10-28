"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MessageCircle, MoreHorizontal, Pencil, Phone, Trash2, UserRoundMinus, UserRoundCog } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getOccupationPresentation } from "@/lib/events/occupation-presentation";
import type { RegistrationWithAttendees } from "@/modules/events";
import { buildWhatsAppInvitationUrl } from "./registration-contact-links";
import { editAttendeeAction, removeCompanionAction, type EditAttendeeState, type RemoveCompanionState } from "./actions";
import { ReplaceCompanionDialog } from "./replace-companion-dialog";
import { TransferPrimaryDialog } from "./transfer-primary-dialog";

const fieldClass = "h-10 rounded-md border border-input bg-transparent px-3 text-sm";
const OCCUPATION_VALUES = ["wholesaler", "manufacturer", "architect-decorator", "installer-technician"] as const;
const OCCUPATION_ITEMS = Object.fromEntries(
  OCCUPATION_VALUES.map((value) => [value, getOccupationPresentation(value).label]),
) as Record<(typeof OCCUPATION_VALUES)[number], string>;

type AttendeeFormData = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  occupation: string;
};

function AttendeeFormFields({
  attendee,
  collectCompany,
  collectJobTitle,
  phoneRequired,
  allRequired = false,
  occupation,
  setOccupation,
}: {
  attendee: AttendeeFormData;
  collectCompany: boolean;
  collectJobTitle: boolean;
  phoneRequired: boolean;
  allRequired?: boolean;
  occupation: string;
  setOccupation: (value: string) => void;
}) {
  return (
    <>
      <input name="fullName" defaultValue={attendee.fullName} placeholder="Nombre completo" required className={fieldClass} />
      <input name="email" type="email" defaultValue={attendee.email} placeholder="Correo" required className={fieldClass} />
      <input name="phone" type="tel" defaultValue={attendee.phone} placeholder="Teléfono" required={phoneRequired || allRequired} aria-required={phoneRequired || allRequired} aria-label="Teléfono" className={fieldClass} />
      {collectCompany ? <input name="company" defaultValue={attendee.company} placeholder="Empresa" required={allRequired} aria-required={allRequired} className={fieldClass} /> : null}
      {collectJobTitle ? <input name="jobTitle" defaultValue={attendee.jobTitle} placeholder="Puesto" required={allRequired} aria-required={allRequired} className={fieldClass} /> : null}
      <input type="hidden" name="occupation" value={occupation} required />
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Actividad profesional</label>
        <Select value={occupation} onValueChange={(value) => setOccupation(value ?? "")} items={OCCUPATION_ITEMS}>
          <SelectTrigger className="h-11 w-full rounded-lg border-border/80 bg-background/80 shadow-sm transition-colors hover:border-primary/50 data-placeholder:text-muted-foreground">
            <SelectValue placeholder="Selecciona una actividad" />
          </SelectTrigger>
          <SelectContent positionerClassName="z-[70]">
            {OCCUPATION_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {OCCUPATION_ITEMS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

export function AttendeeActions({
  registration,
  attendee,
  eventId,
  eventName,
  collectCompany,
  collectJobTitle,
  phoneRequired,
  isPrimary,
  canManage,
}: {
  registration: RegistrationWithAttendees;
  attendee: RegistrationWithAttendees["attendees"][number];
  eventId: string;
  eventName: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  phoneRequired: boolean;
  isPrimary: boolean;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [editState, editAction, editPending] = useActionState<EditAttendeeState, FormData>(editAttendeeAction, {});
  const [removeState, removeAction, removePending] = useActionState<RemoveCompanionState, FormData>(removeCompanionAction, {});
  const [occupation, setOccupation] = useState(attendee.occupation ?? "");
  const router = useRouter();

  useEffect(() => {
    if (!editState.success) return;
    setEditOpen(false);
    router.refresh();
  }, [editState.success, router]);

  useEffect(() => {
    if (!removeState.success) return;
    setRemoveOpen(false);
    router.refresh();
  }, [removeState.success, router]);

  const isRemovable = !isPrimary && !attendee.checkedInAt && attendee.isActive !== false;
  const canContact = Boolean(attendee.phone);
  if (!canContact && !canManage) return null;

  const baseAttendee = {
    fullName: attendee.fullName,
    email: attendee.email,
    phone: attendee.phone ?? "",
    company: attendee.company ?? "",
    jobTitle: attendee.jobTitle ?? "",
    occupation: attendee.occupation ?? "",
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Más acciones para ${attendee.fullName}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          positionerClassName="z-[70]"
          className="w-44 [--floating-popup-item-padding-block:0.35rem] [--floating-popup-padding:0.2rem]"
        >
          {canContact ? (
            <>
              <DropdownMenuItem
                className="min-h-9 gap-2 text-[13px]"
                render={<a href={`tel:${attendee.phone}`} />}
              >
                <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" /> Llamar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-9 gap-2 text-[13px]"
                render={
                  <a
                    href={buildWhatsAppInvitationUrl({ phone: attendee.phone!, attendeeName: attendee.fullName, eventName, backupCode: attendee.backupCode })}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <MessageCircle className="size-3.5 text-muted-foreground" aria-hidden="true" /> WhatsApp
              </DropdownMenuItem>
            </>
          ) : null}
          {canManage ? (
            <>
              {canContact ? <DropdownMenuSeparator className="my-1 -mx-0.5" /> : null}
              <DropdownMenuItem
                className="min-h-9 gap-2 text-[13px]"
                onClick={() => {
                  setOccupation(attendee.occupation ?? "");
                  setEditOpen(true);
                }}
              >
                <Pencil className="size-3.5 text-muted-foreground" aria-hidden="true" /> Editar datos
              </DropdownMenuItem>
              {isRemovable ? (
                <DropdownMenuItem
                  className="min-h-9 gap-2 text-[13px]"
                  onClick={() => {
                    setOccupation("");
                    setReplaceOpen(true);
                  }}
                >
                  <UserRoundMinus className="size-3.5 text-muted-foreground" aria-hidden="true" /> Reemplazar
                </DropdownMenuItem>
              ) : null}
              {isPrimary ? (
                <DropdownMenuItem className="min-h-9 gap-2 text-[13px]" onClick={() => { setOccupation(""); setTransferOpen(true); }}>
                  <UserRoundCog className="size-3.5 text-muted-foreground" aria-hidden="true" /> Transferir titularidad
                </DropdownMenuItem>
              ) : null}
              {isRemovable ? <DropdownMenuSeparator className="my-1 -mx-0.5" /> : null}
              {isRemovable ? (
                <DropdownMenuItem
                  variant="destructive"
                  className="min-h-9 gap-2 text-[13px]"
                  onClick={() => setRemoveOpen(true)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> Eliminar
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogPrimitive.Root open={editOpen} onOpenChange={setEditOpen}>
        {editOpen ? (
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/60" />
            <DialogPrimitive.Popup className="fixed inset-0 z-[60] m-auto h-fit max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl">
              <button type="button" onClick={() => setEditOpen(false)} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Cerrar">
                <span aria-hidden>×</span>
              </button>
              <DialogPrimitive.Title className="text-base font-semibold">Editar datos del asistente</DialogPrimitive.Title>
              <p className="mt-1 text-sm text-muted-foreground">Corregí los datos de {attendee.fullName}.</p>
              <form action={editAction} className="mt-5 flex flex-col gap-3">
                <input type="hidden" name="registrationId" value={registration.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="attendeeId" value={attendee.id} />
                <AttendeeFormFields attendee={baseAttendee} collectCompany={collectCompany} collectJobTitle={collectJobTitle} phoneRequired={phoneRequired} occupation={occupation} setOccupation={setOccupation} />
                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" disabled={editPending}>{editPending ? "Guardando…" : "Guardar cambios"}</Button>
                </div>
                {editState.error ? <p role="alert" className="text-sm text-destructive">{editState.error}</p> : null}
                {editState.success ? <p className="text-sm text-muted-foreground">{editState.emailResent ? "Datos guardados y invitación reenviada al nuevo correo." : "Datos guardados."}</p> : null}
              </form>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        ) : null}
      </DialogPrimitive.Root>

      {replaceOpen ? (
        <ReplaceCompanionDialog eventId={eventId} registrationId={registration.id} attendee={attendee} approved={registration.reviewStatus === "approved"} onClose={() => setReplaceOpen(false)}>
          <AttendeeFormFields attendee={{ fullName: "", email: "", phone: "", company: "", jobTitle: "", occupation: "" }} collectCompany={collectCompany} collectJobTitle={collectJobTitle} phoneRequired={phoneRequired} occupation={occupation} setOccupation={setOccupation} />
        </ReplaceCompanionDialog>
      ) : null}

      {transferOpen ? (
        <TransferPrimaryDialog eventId={eventId} registrationId={registration.id} attendee={attendee} approved={registration.reviewStatus === "approved"} companions={registration.attendees.filter((candidate) => candidate.id !== attendee.id && candidate.isActive !== false).length} onClose={() => setTransferOpen(false)}>
          <input type="hidden" name="company" value={attendee.company ?? ""} />
          <AttendeeFormFields attendee={{ fullName: "", email: "", phone: "", company: "", jobTitle: "", occupation: "" }} collectCompany={false} collectJobTitle={collectJobTitle} phoneRequired={true} allRequired occupation={occupation} setOccupation={setOccupation} />
        </TransferPrimaryDialog>
      ) : null}

      <DialogPrimitive.Root open={removeOpen} onOpenChange={setRemoveOpen}>
        {removeOpen ? (
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/60" />
            <DialogPrimitive.Popup className="fixed inset-0 z-[60] m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl">
              <DialogPrimitive.Title className="text-base font-semibold">Eliminar acompañante</DialogPrimitive.Title>
              <p className="mt-1 text-sm text-muted-foreground">
                ¿Seguro que querés eliminar a <span className="font-semibold">{attendee.fullName}</span> ({attendee.email})? Se liberará su lugar y su acceso dejará de funcionar.
              </p>
              <form action={removeAction} className="mt-5 flex justify-end gap-2">
                <input type="hidden" name="registrationId" value={registration.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="attendeeId" value={attendee.id} />
                <Button type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="destructive" size="sm" disabled={removePending}>{removePending ? "Eliminando…" : "Eliminar"}</Button>
              </form>
              {removeState.error ? <p role="alert" className="mt-3 text-sm text-destructive">{removeState.error}</p> : null}
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        ) : null}
      </DialogPrimitive.Root>
    </>
  );
}
