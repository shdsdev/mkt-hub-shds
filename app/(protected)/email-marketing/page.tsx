import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { listEmailCampaigns, listEmailSegments } from "@/modules/email-marketing";
import { CampaignLibrary } from "./campaign-library";
import { EmailMarketingHeader } from "./email-marketing-header";

export default async function EmailMarketingPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const [campaigns, segments] = await Promise.all([
    listEmailCampaigns(user.profile.organizationId),
    listEmailSegments(user.profile.organizationId),
  ]);
  const segmentNames = Object.fromEntries(segments.map((segment) => [segment.id, segment.name]));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-10">
      <EmailMarketingHeader
        active="campaigns"
        eyebrow="Campaign studio"
        title="Email Marketing"
        description="Diseña campañas para tus contactos y asistentes de eventos, con consentimiento y entrega trazable."
        action={<Link href="/email-marketing/campaigns/new" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Nueva campaña</Link>}
      />

      <section className="grid border-y border-border sm:grid-cols-3" aria-label="Resumen de Email Marketing">
        <MetricCard label="Contactos" value="--" detail="Se conectarán al registro de Eventos" />
        <MetricCard label="Campañas enviadas" value={String(campaigns.filter((campaign) => campaign.status === "sent").length)} detail="En esta organización" />
        <MetricCard label="Próximo envío" value="--" detail="Todavía no hay campañas programadas" />
      </section>

      <section>
        <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Biblioteca de envíos</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold">Tus campañas</h2>
          </div>
          <p className="text-xs text-muted-foreground">Los destinatarios se congelan antes de programar.</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border/80 px-5 py-12 text-center">
            <p className="font-heading text-lg font-semibold">Todavía no hay campañas</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Empieza con una audiencia, arma el contenido y revisa el consentimiento antes de programar tu primer envío.
            </p>
            <Link href="/email-marketing/campaigns/new" className="mt-5 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">
              Crear la primera campaña
            </Link>
          </div>
        ) : <CampaignLibrary campaigns={campaigns} segmentNames={segmentNames} />}
      </section>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="py-4 sm:px-5 sm:py-5 sm:first:pl-0 sm:last:pr-0 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-border sm:[&:not(:first-child)]:pl-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}
