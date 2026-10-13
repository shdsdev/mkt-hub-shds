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

const OPTION_LABELS: Record<string, string> = {
  shades: "Shades",
  bmighty: "BMighty",
  drapery: "Drapery",
  "battery-motors": "Motores de baterías",
  "wifi-automation": "Motores WiFi y automatización",
  curtains: "Cortinería",
  "manual-and-motorized-rods": "Cortineros manuales y motorizados",
};
const OCCUPATION_LABELS: Record<string, string> = {
  distributor: "Distribuidor/a",
  manufacturer: "Fabricante",
  architect: "Arquitecto/a",
  decorator: "Decorador/a",
  "installer-technician": "Instalador/a o técnico/a",
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

          {registration.requestedMoreCompanions || registration.clientBrands.length > 0 || registration.interests.length > 0 || registration.consents ? (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-muted-foreground">Formulario</h3>
              {registration.requestedMoreCompanions ? <p>Solicita más acompañantes: sí</p> : null}
              {registration.clientBrands.length > 0 ? (
                <p>Marcas: {registration.clientBrands.map((value) => OPTION_LABELS[value] ?? value).join(", ")}</p>
              ) : null}
              {registration.interests.length > 0 ? (
                <p>Intereses: {registration.interests.map((value) => OPTION_LABELS[value] ?? value).join(", ")}</p>
              ) : null}
              {registration.consents ? (
                <div className="text-xs text-muted-foreground">
                  <p>Privacidad: {new Date(registration.consents.privacyAcceptedAt).toLocaleString()}</p>
                  <p>Términos: {new Date(registration.consents.termsAcceptedAt).toLocaleString()}</p>
                  {registration.consents.marketingAcceptedAt ? (
                    <p>Marketing: {new Date(registration.consents.marketingAcceptedAt).toLocaleString()}</p>
                  ) : null}
                </div>
              ) : null}
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
                {attendee.occupation ? (
                  <p className="text-muted-foreground">Actividad: {OCCUPATION_LABELS[attendee.occupation] ?? attendee.occupation}</p>
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
