import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { listEmailCampaigns } from "@/modules/email-marketing";

const statusLabels = {
  draft: "Borrador",
  scheduled: "Programada",
  sending: "Enviando",
  sent: "Enviada",
  cancelled: "Cancelada",
  failed: "Fallida",
} as const;

export default async function EmailMarketingPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const campaigns = await listEmailCampaigns(user.profile.organizationId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-1 pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Campaign studio</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Email Marketing</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Diseñá campañas para tus contactos y asistentes de eventos, con consentimiento y entrega trazable.
            </p>
            <nav className="mt-5 flex flex-wrap gap-2" aria-label="Email Marketing">
              <Link href="/email-marketing" className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-foreground">Campañas</Link>
              <Link href="/email-marketing/contacts" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">Contactos</Link>
              <Link href="/email-marketing/segments" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">Segmentos</Link>
            </nav>
          </div>
          <Link
            href="/email-marketing/campaigns/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Nueva campaña
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Contactos" value="--" detail="Se conectarán al registro de Eventos" />
        <MetricCard label="Campañas enviadas" value={String(campaigns.filter((campaign) => campaign.status === "sent").length)} detail="En esta organización" />
        <MetricCard label="Próximo envío" value="--" detail="Todavía no hay campañas programadas" />
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Biblioteca de envíos</p>
            <h2 className="mt-1 font-heading text-xl font-semibold">Tus campañas</h2>
          </div>
          <p className="text-xs text-muted-foreground">Los destinatarios se congelan antes de programar.</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border/80 bg-background/30 px-5 py-10 text-center">
            <p className="font-heading text-lg font-semibold">Todavía no hay campañas</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Empezá con una audiencia, armá el contenido y revisá el consentimiento antes de programar tu primer envío.
            </p>
            <Link href="/email-marketing/campaigns/new" className="mt-5 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">
              Crear la primera campaña
            </Link>
          </div>
        ) : (
          <ul className="mt-5 grid gap-3">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="flex flex-col gap-3 rounded-xl border border-border/80 bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{campaign.subject}</p>
                </div>
                <span className="w-fit rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  {statusLabels[campaign.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card/60 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}
