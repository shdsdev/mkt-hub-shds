"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { SafeHcsConnection } from "@/modules/integrations";
import {
  generateHcsPairingCodeAction,
  renewHcsConnectionAction,
  revokeHcsConnectionAction,
  type HcsIntegrationActionState,
} from "./actions";

const initialState: HcsIntegrationActionState = {};
const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Sin vencimiento";
}

function connectionStatus(connection: SafeHcsConnection) {
  if (connection.revokedAt) return "Revocada";
  if (connection.expiresAt && connection.expiresAt <= new Date()) return "Vencida";
  return "Activa";
}

export function HcsIntegrations({ connections }: { connections: SafeHcsConnection[] }) {
  const [pairingState, pairingAction, pairingPending] = useActionState(
    generateHcsPairingCodeAction,
    initialState,
  );
  const [renewState, renewAction, renewPending] = useActionState(
    renewHcsConnectionAction,
    initialState,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeHcsConnectionAction,
    initialState,
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h2 className="font-heading text-xl font-semibold">Integraciones</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Administrá las conexiones de HCS de tu organización. Los códigos y tokens completos se
          muestran una sola vez.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div>
          <h3 className="font-heading font-medium">Conectar HCS</h3>
          <p className="text-xs text-muted-foreground">
            Generá un código de pairing válido durante 15 minutos para que HCS pueda vincular una
            empresa.
          </p>
        </div>
        <form action={pairingAction}>
          <Button type="submit" disabled={pairingPending}>
            {pairingPending ? "Generando…" : "Generar código de pairing"}
          </Button>
        </form>
        {pairingState.pairingCode ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3" role="status" aria-live="polite">
            <p className="text-xs font-medium">Código disponible ahora</p>
            <code className="mt-1 block break-all text-sm font-semibold tracking-wide">
              {pairingState.pairingCode}
            </code>
            <p className="mt-1 text-xs text-muted-foreground">
              Vence: {formatDate(pairingState.expiresAt ?? null)}. No se volverá a mostrar después.
            </p>
          </div>
        ) : null}
        {pairingState.error ? <p className="text-sm text-destructive" role="alert">{pairingState.error}</p> : null}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading font-medium">Conexiones actuales</h3>
          <p className="text-xs text-muted-foreground">Tokens protegidos y vinculados a tu organización.</p>
        </div>

        {connections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            Todavía no hay conexiones HCS. Generá un código de pairing para comenzar.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                  <th className="px-4 py-3 font-medium">Vencimiento</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((connection) => (
                  <tr key={connection.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <strong className="block font-medium">{connection.hcsCompanyName}</strong>
                      <span className="block text-xs text-muted-foreground">{connection.hcsCompanyId}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{connection.accessTokenPrefix}…</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(connection.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(connection.expiresAt)}</td>
                    <td className="px-4 py-3">{connectionStatus(connection)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <form action={renewAction}>
                          <input type="hidden" name="connectionId" value={connection.id} />
                          <Button type="submit" variant="outline" size="sm" disabled={renewPending}>
                            {renewPending ? "Renovando…" : "Renovar"}
                          </Button>
                        </form>
                        {!connection.revokedAt ? (
                          <form action={revokeAction}>
                            <input type="hidden" name="connectionId" value={connection.id} />
                            <Button type="submit" variant="destructive" size="sm" disabled={revokePending}>
                              {revokePending ? "Revocando…" : "Revocar"}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {renewState.accessToken ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3" role="status" aria-live="polite">
            <p className="text-xs font-medium">Token renovado para {renewState.companyName}</p>
            <code className="mt-1 block break-all text-sm font-semibold">{renewState.accessToken}</code>
            <p className="mt-1 text-xs text-muted-foreground">Guardalo ahora. No se volverá a mostrar.</p>
          </div>
        ) : null}
        {renewState.error || revokeState.error ? (
          <p className="text-sm text-destructive" role="alert">{renewState.error ?? revokeState.error}</p>
        ) : null}
        {revokeState.success ? <p className="text-sm text-muted-foreground" role="status">{revokeState.success}</p> : null}
      </section>
    </div>
  );
}
