import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { listEmailContacts } from "@/modules/email-marketing";

const statusLabels = {
  subscribed: "Suscripto",
  unsubscribed: "Dado de baja",
  suppressed: "Suprimido",
  pending: "Pendiente",
} as const;

export default async function EmailContactsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const contacts = await listEmailContacts(user.profile.organizationId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <header className="rounded-2xl border border-border bg-card/70 p-6 sm:p-8">
        <nav className="flex flex-wrap gap-2" aria-label="Email Marketing">
          <Link href="/email-marketing" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">Campañas</Link>
          <Link href="/email-marketing/contacts" className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-foreground">Contactos</Link>
          <Link href="/email-marketing/segments" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">Segmentos</Link>
        </nav>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Base de audiencia</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">Contactos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Personas únicas por organización, con su consentimiento y relación con eventos.</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {contacts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-heading text-lg font-semibold">Todavía no hay contactos</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Los contactos aparecerán cuando un registro de Evento incluya consentimiento de marketing y se sincronice con Email Marketing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-border bg-background/30 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Contacto</th><th className="px-5 py-3 font-medium">Empresa</th><th className="px-5 py-3 font-medium">Estado</th><th className="px-5 py-3 font-medium">Actualizado</th></tr></thead>
              <tbody className="divide-y divide-border/70">{contacts.map((contact) => <tr key={contact.id} className="hover:bg-muted/20"><td className="px-5 py-4"><p className="font-medium">{contact.fullName || "Sin nombre"}</p><p className="mt-1 text-xs text-muted-foreground">{contact.email}</p></td><td className="px-5 py-4 text-muted-foreground">{contact.company || "--"}</td><td className="px-5 py-4"><span className="rounded-full border border-border px-2.5 py-1 text-xs">{statusLabels[contact.subscriptionStatus]}</span></td><td className="px-5 py-4 text-xs text-muted-foreground">{contact.updatedAt.toLocaleDateString("es-MX")}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
