"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags, Upload } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EmailContact, EmailTag, EmailContactListOptions, EmailSegment } from "@/modules/email-marketing";
import { ContactForm } from "./contact-form";
import { ContactTable } from "./contact-table";
import { CreateTagForm } from "./create-tag-form";
import { ImportContactsForm } from "./import-contacts-form";
import { EmailMarketingHeader } from "../email-marketing-header";

type Panel = "contact" | "import" | "tags" | null;

export function ContactWorkspace({
  contacts,
  total,
  page,
  pageSize,
  filter,
  tags,
  segments,
  statusLabels,
}: {
  contacts: EmailContact[];
  total: number;
  page: number;
  pageSize: number;
  filter: EmailContactListOptions;
  tags: EmailTag[];
  segments: EmailSegment[];
  statusLabels: Record<EmailContact["subscriptionStatus"], string>;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [importBusy, setImportBusy] = useState(false);
  const router = useRouter();

  return (
    <>
      <EmailMarketingHeader
        active="contacts"
        eyebrow="Base de audiencia"
        title="Contactos"
        description="Consultá quiénes forman parte de tu audiencia y organizalos para tus campañas."
        action={<div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPanel("contact")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Plus size={16} />Agregar contacto</button>
            <button type="button" onClick={() => setPanel("import")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Upload size={16} />Importar CSV</button>
            <button type="button" onClick={() => setPanel("tags")} aria-label="Gestionar etiquetas" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Tags size={16} />Etiquetas</button>
          </div>}
      />

      <section className="min-w-0">
         <ContactTable contacts={contacts} total={total} page={page} pageSize={pageSize} filter={filter} tags={tags} segments={segments} statusLabels={statusLabels} onContactOpen={(contact) => router.push(`/email-marketing/contacts/${contact.id}`)} />
      </section>

      <Sheet open={panel !== null} onOpenChange={(open) => { if (!open && importBusy) return; setPanel(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" showCloseButton={!importBusy}>
          {panel === "contact" ? <>
            <SheetHeader className="border-b border-border"><SheetTitle>Agregar contacto</SheetTitle><SheetDescription>Se guardará como pendiente y no recibirá campañas hasta contar con consentimiento.</SheetDescription></SheetHeader>
            <div className="p-4 sm:p-6"><ContactForm /></div>
          </> : null}
          {panel === "import" ? <>
            <SheetHeader className="border-b border-border"><SheetTitle>Importar contactos</SheetTitle><SheetDescription>Revisá las filas antes de confirmar. Los duplicados actualizan datos sin sobrescribir bajas ni supresiones.</SheetDescription></SheetHeader>
            <div className="p-4 sm:p-6"><ImportContactsForm onBusyChange={setImportBusy} onComplete={() => setPanel(null)} /></div>
          </> : null}
          {panel === "tags" ? <>
            <SheetHeader className="border-b border-border"><SheetTitle>Gestionar etiquetas</SheetTitle><SheetDescription>Usá etiquetas para organizar contactos sin mezclarlas con el consentimiento.</SheetDescription></SheetHeader>
            <div className="space-y-6 p-4 sm:p-6"><CreateTagForm /><div><h3 className="text-sm font-semibold">Etiquetas existentes</h3><div className="mt-3 flex flex-wrap gap-2">{tags.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay etiquetas.</p> : tags.map((tag) => <span key={tag.id} className="rounded-full border border-border px-3 py-1.5 text-xs">{tag.name}</span>)}</div></div></div>
          </> : null}
          {!importBusy ? <SheetClose className="sr-only">Cerrar panel</SheetClose> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
