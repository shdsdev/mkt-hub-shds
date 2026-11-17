import Link from "next/link";
import { Activity, ArrowUpRight, CalendarDays, Link2, Megaphone, QrCode } from "lucide-react";
import { getCurrentUser } from "@/modules/auth";
import { listLinks } from "@/modules/links";
import { countActiveQrCodes } from "@/modules/qr";
import { listCampaigns } from "@/modules/campaigns";
import { getOrgTrafficLast30Days } from "@/modules/analytics";
import type { LucideIcon } from "lucide-react";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgId = user.profile.organizationId;
  const [links, activeQrCodes, campaigns, traffic30d] = await Promise.all([
    listLinks(orgId),
    countActiveQrCodes(orgId),
    listCampaigns(orgId),
    getOrgTrafficLast30Days(orgId),
  ]);

  const activeLinks = links.filter((link) => link.status === "active").length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;

  const recentLinks = [...links]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <header className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marketing Hub</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Resumen</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Una vista rápida de tus activos de marketing y la actividad de los últimos 30 días.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/qr/quick"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <QrCode className="size-4" aria-hidden="true" />
            Crear QR
          </Link>
          <Link
            href="/analytics"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Ver analytics
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section aria-labelledby="overview-metrics">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="overview-metrics" className="font-heading text-lg font-semibold tracking-tight">Actividad de la cuenta</h2>
          <span className="text-xs text-muted-foreground">Últimos 30 días</span>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <Stat label="Enlaces activos" value={activeLinks} icon={Link2} href="/links" />
          <Stat label="Códigos QR activos" value={activeQrCodes} icon={QrCode} href="/qr" />
          <Stat label="Campañas activas" value={activeCampaigns} icon={Megaphone} href="/campaigns" />
          <Stat label="Clics + escaneos" value={traffic30d} icon={Activity} href="/analytics" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section aria-labelledby="recent-links" className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Biblioteca</p>
              <h2 id="recent-links" className="mt-1 font-heading text-lg font-semibold tracking-tight">Enlaces recientes</h2>
            </div>
            <Link href="/links" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
              Ver todos
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          {recentLinks.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
              <Link2 className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">Aún no hay enlaces</p>
              <p className="mt-1 text-sm text-muted-foreground">Crea tu primer enlace para comenzar a medir actividad.</p>
              <Link href="/links" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-muted px-3 text-sm font-semibold transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                Abrir enlaces
              </Link>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {recentLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    href={`/links/${link.id}`}
                    className="group flex min-h-14 items-center justify-between gap-4 py-3 outline-none transition-colors first:pt-0 last:pb-0 focus-visible:text-primary"
                  >
                    <span className="min-w-0 truncate font-mono text-sm group-hover:text-primary">{link.destinationUrl}</span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="quick-actions" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Atajos</p>
          <h2 id="quick-actions" className="mt-1 font-heading text-lg font-semibold tracking-tight">Siguiente paso</h2>
          <ul className="mt-5 grid gap-2">
            <QuickAction href="/qr/quick" icon={QrCode} title="Generar un código QR" description="Crea un QR listo para compartir." />
            <QuickAction href="/campaigns" icon={Megaphone} title="Revisar campañas" description="Consulta el estado de tus campañas." />
            <QuickAction href="/events" icon={CalendarDays} title="Gestionar eventos" description="Administra registros y asistentes." />
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, href }: { label: string; value: number; icon: LucideIcon; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      <p className="mt-5 font-heading text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}

function QuickAction({ href, icon: Icon, title, description }: { href: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <li>
      <Link href={href} className="group flex min-h-16 items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
        </span>
        <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}
