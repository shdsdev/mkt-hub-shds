"use client";

import { useActionState, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Theme, ThemeColorOverrideToken } from "@/modules/users";
import {
  setThemeColorOverrideAction,
  clearThemeColorOverrideAction,
  type ThemeColorOverrideFormState,
} from "../actions";

const initialState: ThemeColorOverrideFormState = {};

const TOKEN_LABELS: Record<ThemeColorOverrideToken, string> = {
  primary: "Primario",
  accent: "Acento",
  background: "Fondo",
};

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function ColorField({
  themeId,
  token,
  defaultHex,
}: {
  themeId: string;
  token: ThemeColorOverrideToken;
  defaultHex: string;
}) {
  const [hex, setHex] = useState(defaultHex);
  const [setState, setAction, setPending] = useActionState(setThemeColorOverrideAction, initialState);
  const [clearState, clearAction, clearPending] = useActionState(clearThemeColorOverrideAction, initialState);
  const isValid = HEX_PATTERN.test(hex);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <span
          className="h-6 w-6 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: isValid ? hex : defaultHex }}
          aria-hidden="true"
        />
        <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{TOKEN_LABELS[token]}</span>
        <form action={setAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="themeId" value={themeId} />
          <input type="hidden" name="token" value={token} />
          <input
            type="color"
            value={isValid ? hex : defaultHex}
            onChange={(event) => setHex(event.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
            aria-label={`Selector de color para ${TOKEN_LABELS[token]}`}
          />
          <Input
            name="hex"
            value={hex}
            onChange={(event) => setHex(event.target.value)}
            className="w-24 font-mono text-xs"
            aria-label={`Hexadecimal para ${TOKEN_LABELS[token]}`}
          />
          <Button type="submit" variant="outline" size="sm" disabled={setPending || !isValid}>
            Guardar
          </Button>
        </form>
        <form action={clearAction}>
          <input type="hidden" name="themeId" value={themeId} />
          <input type="hidden" name="token" value={token} />
          <Button type="submit" variant="ghost" size="sm" disabled={clearPending}>
            Restablecer
          </Button>
        </form>
      </div>
      {(setState.error || setState.success) && (
        <p role={setState.error ? "alert" : "status"} className="pl-[7.5rem] text-xs text-muted-foreground">
          {setState.error ?? setState.success}
        </p>
      )}
      {(clearState.error || clearState.success) && (
        <p role={clearState.error ? "alert" : "status"} className="pl-[7.5rem] text-xs text-muted-foreground">
          {clearState.error ?? clearState.success}
        </p>
      )}
    </div>
  );
}

// ADMIN-only (2026-10-15 Arctic Frost design) — only the 3 swatch tokens are editable; every other
// CSS custom property per theme stays fixed in globals.css. One independent mini-form per token
// (not one combined form), matching this file's existing per-field form convention
// (user-management.tsx's role/disable/reactivate forms).
export function ThemeColorEditor({ theme }: { theme: Theme }) {
  const [open, setOpen] = useState(false);
  const [primary, accent, background] = theme.swatch;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        Editar colores
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover px-6 py-6 text-popover-foreground shadow-2xl">
          <Dialog.Title className="text-lg font-semibold tracking-tight">
            Editar colores — {theme.label}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Solo los 3 colores principales del tema. El resto de la interfaz queda sin cambios.
          </Dialog.Description>
          <div className="mt-4 flex flex-col gap-3">
            <ColorField themeId={theme.id} token="primary" defaultHex={primary} />
            <ColorField themeId={theme.id} token="accent" defaultHex={accent} />
            <ColorField themeId={theme.id} token="background" defaultHex={background} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
