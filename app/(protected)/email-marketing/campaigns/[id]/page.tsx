import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEmailCampaign, listEmailSegments } from "@/modules/email-marketing";
import { duplicateEmailCampaignAction } from "../actions";

const statusLabels = {
  draft: "Borrador",
  scheduled: "Programada",
  sending: "Enviando",
  sent: "Enviada",
  cancelled: "Cancelada",
  failed: "Fallida",
} as const;

export default async function EmailCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const campaign = await getEmailCampaign({
    organizationId: user.profile.organizationId,
    campaignId: id,
  });
  if (!campaign) notFound();
  const segment = campaign.segmentId
    ? (await listEmailSegments(user.profile.organizationId)).find((candidate) => candidate.id === campaign.segmentId)
    : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10">
      <header className="border-b border-border pb-6 sm:pb-8">
        <Link href="/email-marketing" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver a campañas
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Campaign studio</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{campaign.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{campaign.subject}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {statusLabels[campaign.status]}
            </span>
            {campaign.status === "draft" ? (
              <Link href={`/email-marketing/campaigns/${campaign.id}/edit`} className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">
                Editar campaña
              </Link>
            ) : null}
            <form action={duplicateEmailCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button type="submit" className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                Duplicar como borrador
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-[#e9edf2] p-4 sm:p-8">
          <iframe
            title={`Vista previa de ${campaign.name}`}
            sandbox="allow-same-origin"
            srcDoc={campaign.htmlSnapshot}
            className="mx-auto block min-h-[640px] w-full max-w-[760px] border-0 bg-white shadow-xl shadow-black/10"
          />
        </div>
        <aside className="h-fit space-y-5 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalles</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Audiencia</dt>
                <dd className="mt-1">{segment?.name ?? (campaign.segmentId ? "Segmento no disponible" : "Todos los suscriptos")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Creada</dt>
                <dd className="mt-1">{campaign.createdAt.toLocaleDateString("es-MX")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Remitente</dt>
                <dd className="mt-1">{campaign.fromName || "Configuración de marketing"}</dd>
              </div>
            </dl>
          </div>
          {campaign.status === "draft" ? (
            <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
              Este borrador ya está guardado y se puede consultar desde esta vista. La edición persistente se habilitará con el siguiente paso del editor.
            </p>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
