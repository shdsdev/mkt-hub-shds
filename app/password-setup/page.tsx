"use client";

import { useActionState } from "react";
import { setInvitationPassword, type PasswordSetupFormState } from "./actions";
import { BinaryLoader } from "@/components/binary-loader";

const initialState: PasswordSetupFormState = {};

export default function PasswordSetupPage() {
  const [state, formAction, pending] = useActionState(setInvitationPassword, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-8"
      >
        <h1 className="font-heading text-2xl font-semibold">Establece tu contraseña</h1>
        <p className="text-sm text-muted-foreground">
          Define una contraseña para activar tu cuenta. Debe tener al menos 12 caracteres.
        </p>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-muted-foreground">
            Nueva contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? <BinaryLoader /> : "Activar cuenta"}
        </button>
      </form>
    </main>
  );
}