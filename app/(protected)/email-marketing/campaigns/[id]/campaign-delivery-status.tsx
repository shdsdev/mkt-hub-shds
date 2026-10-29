"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailCampaignDeliverySummary } from "@/modules/email-marketing";

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

const statusLabels: Record<CampaignStatus, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  sending: "Enviando",
  sent: "Aceptada por el proveedor",
  cancelled: "Cancelada",
  failed: "Fallida",
};

const eventLabels: Record<string, string> = {
  "email.delivered": "Entregado",
  "email.bounced": "Rebotado",
  "email.suppressed": "Suprimido",
  "email.complained": "Marcado como spam",
  "email.failed": "Falló la entrega",
  "email.delivery_delayed": "Entrega demorada",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Pendiente";
}

export function CampaignDeliveryStatus({
  campaign,
  counts,
  failedRecipients,
  recentEvents,
}: {
  campaign: {
    status: CampaignStatus;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
  };
  counts: EmailCampaignDeliverySummary;
  failedRecipients: Array<{ email: string; error: string | null }>;
  recentEvents: Array<{ eventType: string; occurredAt: string }>;
}) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const waitingPastSchedule = campaign.status === "scheduled" && currentTime !== null && Boolean(campaign.scheduledAt && new Date(campaign.scheduledAt).getTime() < currentTime);
  useEffect(() => {
    setCurrentTime(Date.now());
    if (campaign.status !== "scheduled" && campaign.status !== "sending") return;
    const timer = window.setInterval(() => router.refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [campaign.status, router]);

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card/60 p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Seguimiento del envío</p>
          <h2 className="mt-2 text-xl font-semibold">{statusLabels[campaign.status]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Actualizado {formatDate(campaign.updatedAt)} · zona horaria local</p>
        </div>
        {campaign.status === "scheduled" || campaign.status === "sending" ? <span className="rounded-full border border-primary/40 px-3 py-1.5 text-xs text-primary">Actualización automática</span> : null}
      </div>

      {waitingPastSchedule ? <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">La hora programada ya pasó, pero el procesador todavía no inició esta campaña.</p> : null}
      {campaign.status === "sent" ? <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">El proveedor aceptó los mensajes. La entrega final se confirma mediante los eventos de Resend.</p> : null}
      {campaign.status === "failed" ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">El procesamiento terminó con errores. Revisá los destinatarios fallidos antes de reintentar.</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Total", counts.total, "text-foreground"],
          ["Pendientes", counts.pending, "text-amber-300"],
          ["Aceptados", counts.sent, "text-primary"],
          ["Entregados", counts.delivered, "text-accent"],
          ["Fallidos", counts.failed + counts.bounced, "text-destructive"],
          ["Suprimidos", counts.suppressed, "text-muted-foreground"],
        ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-border/70 bg-background/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p></div>)}
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Programada</dt><dd className="mt-1">{formatDate(campaign.scheduledAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Inicio</dt><dd className="mt-1">{formatDate(campaign.startedAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Finalización</dt><dd className="mt-1">{formatDate(campaign.completedAt)}</dd></div>
      </dl>

      {failedRecipients.length ? <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Destinatarios con problemas</h3><ul className="mt-3 space-y-2 text-xs text-muted-foreground">{failedRecipients.map((recipient) => <li key={`${recipient.email}-${recipient.error}`} className="flex flex-col gap-1 rounded-lg border border-border/70 px-3 py-2 sm:flex-row sm:justify-between"><span>{recipient.email}</span><span className="text-destructive">{recipient.error ?? "La entrega no fue confirmada."}</span></li>)}</ul></div> : null}

      {recentEvents.length ? <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Actividad reciente</h3><ul className="mt-3 space-y-2 text-xs text-muted-foreground">{recentEvents.map((event, index) => <li key={`${event.eventType}-${event.occurredAt}-${index}`} className="flex justify-between gap-3"><span>{eventLabels[event.eventType] ?? event.eventType}</span><time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time></li>)}</ul></div> : null}
    </section>
  );
}
