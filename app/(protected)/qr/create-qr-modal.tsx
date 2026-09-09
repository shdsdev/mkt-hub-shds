"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { WebsiteQrForm } from "./website-qr-form";
import { StaticQrForm } from "./static-qr-form";
import { QrSuccessPanel } from "./qr-success-panel";

type Screen = "type" | "website" | "static" | "success";

export function CreateQrModal({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("type");
  const [createdQrCodeId, setCreatedQrCodeId] = useState<string>();

  function reset() {
    setScreen("type");
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
        Create QR code
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/60" />
        <Dialog.Popup className="bg-card fixed top-1/2 left-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border p-6">
          {screen === "type" && (
            <div className="space-y-4">
              <Dialog.Title className="font-heading text-lg font-semibold">
                Create your QR code
              </Dialog.Title>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setScreen("website")}
                  className="rounded-md border border-border bg-background p-4 text-left hover:border-primary"
                >
                  <p className="font-medium">Website</p>
                  <p className="text-xs text-muted-foreground">
                    Link to a URL — creates a trackable short link and dynamic QR.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setScreen("static")}
                  className="rounded-md border border-border bg-background p-4 text-left hover:border-primary"
                >
                  <p className="font-medium">Fixed text</p>
                  <p className="text-xs text-muted-foreground">
                    Encode any fixed text or URL — permanent, untrackable.
                  </p>
                </button>
              </div>
            </div>
          )}

          {screen === "website" && (
            <div className="space-y-4">
              <Dialog.Title className="font-heading text-lg font-semibold">Website QR</Dialog.Title>
              <WebsiteQrForm organizationId={organizationId} onCreated={handleCreated} />
            </div>
          )}

          {screen === "static" && (
            <div className="space-y-4">
              <Dialog.Title className="font-heading text-lg font-semibold">
                Fixed text QR
              </Dialog.Title>
              <StaticQrForm organizationId={organizationId} onCreated={handleCreated} />
            </div>
          )}

          {screen === "success" && createdQrCodeId && (
            <QrSuccessPanel qrCodeId={createdQrCodeId} onClose={() => handleOpenChange(false)} />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
