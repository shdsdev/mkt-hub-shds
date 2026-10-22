"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AtSign, Lock, QrCode } from "lucide-react";
import { login, type LoginFormState } from "./actions";
import { requestPasswordRecovery, type PasswordRecoveryFormState } from "./recovery-actions";
import { BinaryLoader } from "@/components/binary-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "@/components/icons/google-icon";
import { FlutedGlassBackground } from "./fluted-glass-background";

const initialState: LoginFormState = {};
const initialRecoveryState: PasswordRecoveryFormState = {};

// Matches the reference design's own button look exactly — a fixed neutral light pill at the
// original's "lg" dimensions (h-11 px-8), not our app's theme-tinted --primary/size scale. Scoped
// to just these two auth buttons, per explicit request ("mantén los del diseño original").
const authButtonClassName =
  "h-11 w-full justify-center rounded-md bg-zinc-100 px-8 text-sm font-medium text-zinc-900 hover:bg-zinc-100/90";

// White focus ring instead of the active theme's --ring (pink in "midnight"/"signature") — scoped
// to just these two inputs, matching the neutral treatment requested for the auth buttons.
const authInputClassName = "peer ps-9 focus-visible:border-white focus-visible:ring-white/50";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(
    requestPasswordRecovery,
    initialRecoveryState,
  );
  const [showRecovery, setShowRecovery] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string>();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const invitationError = authError === "invitation";
  const recoveryError = authError === "recovery";
  const googleAccessError = authError === "google_access";

  async function handleGoogleSignIn() {
    setGooglePending(true);
    setGoogleError(undefined);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?provider=google&next=/` },
    });
    if (error) {
      setGooglePending(false);
      setGoogleError("No se pudo iniciar sesión con Google.");
    }
  }

  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      <div className="relative hidden h-full flex-col border-r border-border bg-muted/60 p-10 lg:flex">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-background to-transparent" />
        <div className="z-10 flex items-center gap-2">
          <QrCode className="size-6" />
          <p className="text-xl font-semibold">Marketing Hub</p>
        </div>
        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl">
              Enlaces cortos, códigos QR y analíticas — todo en un solo lugar para el equipo de
              marketing.
            </p>
            <footer className="font-mono text-sm font-semibold">~ Shades de México</footer>
          </blockquote>
        </div>
        <FlutedGlassBackground />
      </div>

      <div className="relative flex min-h-screen flex-col justify-center p-4">
        <div aria-hidden className="absolute inset-0 isolate -z-10 contain-strict opacity-60">
          <div className="absolute top-0 right-0 h-80 w-35 -translate-y-22 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
          <div className="absolute top-0 right-0 h-80 w-15 [translate:5%_-50%] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
          <div className="absolute top-0 right-0 h-80 w-15 -translate-y-22 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
        </div>

        <div className="mx-auto w-full space-y-4 sm:max-w-sm">
          <div className="flex items-center gap-2 lg:hidden">
            <QrCode className="size-6" />
            <p className="text-xl font-semibold">Marketing Hub</p>
          </div>

          <div className="flex flex-col space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-wide">Bienvenido de vuelta</h1>
            <p className="text-base text-muted-foreground">Ingresá con tu correo y contraseña.</p>
          </div>

          {(invitationError || recoveryError || googleAccessError) && (
            <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
              {invitationError
                ? "La invitación expiró o ya fue utilizada. Solicita un nuevo enlace para crear tu contraseña."
                : recoveryError
                  ? "El enlace para crear tu contraseña no es válido o expiró. Solicita uno nuevo."
                  : "Tu cuenta no tiene una invitación activa para Marketing Hub."}
            </p>
          )}

          <Button type="button" size="lg" className={cn(authButtonClassName, "gap-2")} onClick={handleGoogleSignIn} disabled={googlePending} aria-busy={googlePending}>
            {googlePending ? <BinaryLoader /> : <GoogleIcon className="size-4" />}
            {googlePending ? "Conectando con Google…" : "Continuar con Google"}
          </Button>
          {googleError && <p role="alert" className="text-sm text-destructive">{googleError}</p>}

          <AuthSeparator />

          <form action={formAction} className="space-y-2">
            <div className="relative h-max">
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu.correo@shadesdemexico.com"
                className={authInputClassName}
              />
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-2.5 text-muted-foreground peer-disabled:opacity-50">
                <AtSign className="size-4" aria-hidden="true" />
              </div>
            </div>

            <div className="relative h-max">
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Contraseña"
                className={authInputClassName}
              />
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-2.5 text-muted-foreground peer-disabled:opacity-50">
                <Lock className="size-4" aria-hidden="true" />
              </div>
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <Button type="submit" size="lg" className={authButtonClassName} disabled={pending}>
              {pending ? <BinaryLoader /> : "Iniciar sesión"}
            </Button>
          </form>

          {!showRecovery ? (
            <Button
              type="button"
              variant="link"
              className="h-auto w-full px-0 text-sm text-muted-foreground"
              onClick={() => setShowRecovery(true)}
            >
              Crear o restablecer contraseña
            </Button>
          ) : (
            <form
              action={recoveryAction}
              data-recovery-form
              className="space-y-3 rounded-md border border-border/70 bg-background/60 p-4"
            >
              <div className="space-y-1">
                <h2 className="text-sm font-medium">Crea tu contraseña</h2>
                <p className="text-xs text-muted-foreground">
                  Te enviaremos un enlace para configurar o restablecer el acceso.
                </p>
              </div>
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu.correo@shadesdemexico.com"
              />
              {recoveryState.error && (
                <p role="alert" className="text-sm text-destructive">
                  {recoveryState.error}
                </p>
              )}
              {recoveryState.success && (
                <p role="status" className="text-sm text-muted-foreground">
                  {recoveryState.success}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" className="flex-1" disabled={recoveryPending}>
                  {recoveryPending ? <BinaryLoader /> : "Enviar enlace"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRecovery(false)}
                >
                  Volver
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function AuthSeparator() {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="h-px w-full bg-border" />
      <span className="px-2 text-xs text-muted-foreground">O</span>
      <div className="h-px w-full bg-border" />
    </div>
  );
}
