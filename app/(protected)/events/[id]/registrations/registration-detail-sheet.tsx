"use client";

import { useState } from "react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { RegistrationWithAttendees } from "@/modules/events";

const UTM_LABELS: Record<string, string> = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmTerm: "utm_term",
  utmContent: "utm_content",
  utmId: "utm_id",
};

// Admin feedback round: "prefiero... abrir un side panel al presionar la fila" — every field the
// table's columns couldn't fit (phone/company/job title per attendee, backup code, check-in
// timestamp, full UTM set, source) without the table itself going unreadably wide.
export function RegistrationDetailSheet({
  registration,
  statusLabel,
}: {
  registration: RegistrationWithAttendees;
  statusLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const utmEntries = (Object.keys(UTM_LABELS) as (keyof typeof UTM_LABELS)[])
    .map((key) => [UTM_LABELS[key], registration[key as keyof RegistrationWithAttendees]] as const)
    .filter(([, value]) => Boolean(value));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="text-xs text-primary underline">Ver detalle</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Registro</SheetTitle>
          <SheetDescription>
            {statusLabel} · {registration.createdAt.toLocaleString()} ·{" "}
            {registration.source === "admin_added" ? "Agregado por admin" : "Público"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">
          {utmEntries.length > 0 ? (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">Origen (UTM)</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {utmEntries.map(([label, value]) => (
                  <li key={label}>
                    {label}: {String(value)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-muted-foreground">
              Asistentes ({registration.attendees.length})
            </h3>
            {registration.attendees.map((attendee) => (
              <div key={attendee.id} className="flex flex-col gap-1 rounded-md border border-border p-3">
                <p className="font-medium">{attendee.fullName}</p>
                <p className="text-muted-foreground">{attendee.email}</p>
                {attendee.phone ? <p className="text-muted-foreground">Tel: {attendee.phone}</p> : null}
                {attendee.company ? (
                  <p className="text-muted-foreground">Empresa: {attendee.company}</p>
                ) : null}
                {attendee.jobTitle ? (
                  <p className="text-muted-foreground">Puesto: {attendee.jobTitle}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">Código de respaldo: {attendee.backupCode}</p>
                <p className="text-xs text-muted-foreground">
                  {attendee.checkedInAt
                    ? `Check-in: ${attendee.checkedInAt.toLocaleString()}`
                    : "Sin check-in"}
                </p>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
