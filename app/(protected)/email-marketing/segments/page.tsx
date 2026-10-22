import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";

export default async function EmailSegmentsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <header className="rounded-2xl border border-border bg-card/70 p-6 sm:p-8">
        <nav className="flex flex-wrap gap-2" aria-label="Email Marketing">
          <Link href="/email-marketing" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">Campañas</Link>
          <Link href="/email-marketing/contacts" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">Contactos</Link>
          <Link href="/email-marketing/segments" className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-foreground">Segmentos</Link>
        </nav>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Audiencias guardadas</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">Segmentos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Guardá filtros por evento, intereses y consentimiento para reutilizarlos en campañas.</p>
      </header>
      <section className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <p className="font-heading text-lg font-semibold">Todavía no hay segmentos guardados</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">El constructor de segmentos permitirá crear audiencias sin SQL y respetando siempre las bajas y supresiones.</p>
      </section>
    </main>
  );
}
