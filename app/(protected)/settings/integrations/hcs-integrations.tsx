"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/checkbox";
import type { SafeHcsConnection } from "@/modules/integrations";
import type { TelegramSettings } from "@/modules/notifications";
import {
  generateHcsPairingCodeAction,
  renewHcsConnectionAction,
  revokeHcsConnectionAction,
  type HcsIntegrationActionState,
  saveTelegramSettingsAction,
  sendTelegramTestMessageAction,
  type TelegramIntegrationActionState,
} from "./actions";

const initialState: HcsIntegrationActionState = {};
const initialTelegramState: TelegramIntegrationActionState = {};
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

export function HcsIntegrations({
  connections,
  telegramSettings,
}: {
  connections: SafeHcsConnection[];
  telegramSettings?: TelegramSettings;
}) {
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
  const [telegramSaveState, telegramSaveAction, telegramSavePending] = useActionState(
    saveTelegramSettingsAction,
    initialTelegramState,
  );
  const [telegramTestState, telegramTestAction, telegramTestPending] = useActionState(
    sendTelegramTestMessageAction,
    initialTelegramState,
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-heading font-medium">Telegram</h3>
            <p className="text-xs text-muted-foreground">
              Recibí avisos de nuevas solicitudes y decisiones en un chat de Telegram.
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${telegramSettings?.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {telegramSettings?.enabled ? "Activo" : telegramSettings ? "Desactivado" : "No configurado"}
          </span>
        </div>

        <form action={telegramSaveAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Chat ID</span>
            <input
              name="chatId"
              defaultValue={telegramSettings?.chatId ?? ""}
              placeholder="-1001234567890"
              maxLength={100}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
              <span className="text-xs text-muted-foreground">
              Usá el ID del grupo o canal donde querés recibir las notificaciones.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Mensaje de solicitud</span>
            <textarea
              name="messageTemplate"
              defaultValue={telegramSettings?.messageTemplate ?? ""}
              maxLength={3000}
              rows={6}
              placeholder="Nuevo registro para {{evento}}\n{{nombre}} solicitó acceso.\nEmpresa: {{empresa}}"
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-xs text-muted-foreground">
              Etiquetas: {"{{evento}} {{nombre}} {{email}} {{telefono}} {{empresa}} {{puesto}} {{ocupacion}} {{estado}} {{fecha_evento}} {{url_revision}}"}
            </span>
          </label>
          <Checkbox
            name="enabled"
            defaultChecked={telegramSettings?.enabled ?? false}
            label={
              <span>
                <span className="block font-medium">Enviar notificaciones de solicitudes</span>
                <span className="block text-xs text-muted-foreground">Se usará como destino predeterminado para los eventos sin chat propio.</span>
              </span>
            }
          />
          <Button type="submit" className="self-start" disabled={telegramSavePending}>
            {telegramSavePending ? "Guardando…" : "Guardar configuración"}
          </Button>
        </form>
        <form action={telegramTestAction}>
          <Button type="submit" variant="outline" disabled={telegramTestPending || !telegramSettings?.enabled}>
            {telegramTestPending ? "Enviando…" : "Enviar mensaje de prueba"}
          </Button>
        </form>
        {telegramSaveState.success ? <p className="text-sm text-muted-foreground" role="status">{telegramSaveState.success}</p> : null}
        {telegramTestState.success ? <p className="text-sm text-muted-foreground" role="status">{telegramTestState.success}</p> : null}
        {telegramSaveState.error || telegramTestState.error ? <p className="text-sm text-destructive" role="alert">{telegramSaveState.error ?? telegramTestState.error}</p> : null}
      </section>

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
