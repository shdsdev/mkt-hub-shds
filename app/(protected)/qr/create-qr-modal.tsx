"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Globe, FileText, IdCard, Mail, MessageSquare, Wifi } from "lucide-react";
import { WebsiteQrForm } from "./website-qr-form";
import { StaticQrForm, type StaticQrKind } from "./static-qr-form";
import { QrSuccessPanel } from "./qr-success-panel";
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";
import type { UtmPreset } from "@/modules/utm";
import type { QrDesignTemplateRow } from "@/modules/qr";

type Screen = "type" | "form" | "success";
type Kind = "website" | StaticQrKind;

const TYPE_CARDS: { kind: Kind; icon: typeof Globe; label: string; description: string }[] = [
  { kind: "website", icon: Globe, label: "Sitio web", description: "Enlaza a una URL — crea un enlace corto rastreable y un QR dinámico." },
  { kind: "text", icon: FileText, label: "Texto fijo", description: "Codifica cualquier texto o URL fijo — permanente, no rastreable." },
  { kind: "vcard", icon: IdCard, label: "vCard", description: "Compartir datos de contacto." },
  { kind: "email", icon: Mail, label: "Correo electrónico", description: "Recibir mensajes por correo electrónico." },
  { kind: "sms", icon: MessageSquare, label: "SMS", description: "Recibir mensajes de texto." },
  { kind: "wifi", icon: Wifi, label: "WiFi", description: "Conexión a una red WiFi." },
];

export function CreateQrModal({
  organizationId,
  folders,
  campaigns,
  utmPresets,
  templates,
  defaultLogoUrl,
}: {
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  utmPresets: UtmPreset[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("type");
  const [selectedKind, setSelectedKind] = useState<Kind>();
  const [createdQrCodeId, setCreatedQrCodeId] = useState<string>();

  function reset() {
    setScreen("type");
    setSelectedKind(undefined);
    setCreatedQrCodeId(undefined);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleCreated(qrCodeId: string) {
    setCreatedQrCodeId(qrCodeId);
    setScreen("success");
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Crear código QR
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2">
          {screen === "type" && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-6">
              <Dialog.Title className="font-heading text-lg font-semibold">
                Crea tu código QR
              </Dialog.Title>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {TYPE_CARDS.map(({ kind, icon: Icon, label, description }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setSelectedKind(kind);
                      setScreen("form");
                    }}
                    className="space-y-1 rounded-md border border-border bg-background p-4 text-left hover:border-primary"
                  >
                    <Icon size={18} className="text-muted-foreground" />
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === "form" && selectedKind === "website" && (
            <WebsiteQrForm
              organizationId={organizationId}
              folders={folders}
              campaigns={campaigns}
              utmPresets={utmPresets}
              templates={templates}
              defaultLogoUrl={defaultLogoUrl}
              onBack={() => setScreen("type")}
              onCreated={handleCreated}
            />
          )}

          {screen === "form" && selectedKind && selectedKind !== "website" && (
            <StaticQrForm
              kind={selectedKind}
              organizationId={organizationId}
              folders={folders}
              campaigns={campaigns}
              templates={templates}
              defaultLogoUrl={defaultLogoUrl}
              onBack={() => setScreen("type")}
              onCreated={handleCreated}
            />
          )}

          {screen === "success" && createdQrCodeId && (
            <div className="rounded-lg border border-border bg-card p-6">
              <QrSuccessPanel qrCodeId={createdQrCodeId} onClose={() => handleOpenChange(false)} />
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
