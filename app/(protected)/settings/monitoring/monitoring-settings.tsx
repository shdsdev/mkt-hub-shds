"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/checkbox";
import {
  saveMonitoringSettingsAction,
  sendMonitoringTestAction,
  type MonitoringActionState,
} from "./actions";
import type { MonitoringSettings } from "@/modules/monitoring";

const initialState: MonitoringActionState = {};

export function MonitoringSettingsForm({ settings }: { settings: MonitoringSettings }) {
  const [saveState, saveAction, savePending] = useActionState(saveMonitoringSettingsAction, initialState);
  const [testState, testAction, testPending] = useActionState(sendMonitoringTestAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div>
          <h2 className="font-heading font-medium">Alertas de plataforma</h2>
          <p className="text-sm text-muted-foreground">Configuración global para toda la plataforma. Los secretos de Sentry permanecen en el hosting.</p>
        </div>
        <form action={saveAction} className="flex flex-col gap-4">
          <Checkbox
            name="enabled"
            defaultChecked={settings.enabled}
            label={<span><span className="block font-medium">Activar monitoreo</span><span className="block text-xs text-muted-foreground">Recibir alertas operativas en Telegram.</span></span>}
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Chat ID del canal de alertas</span>
            <input name="telegramChatId" defaultValue={settings.telegramChatId ?? ""} placeholder="-1001234567890" maxLength={100} className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
            <span className="text-xs text-muted-foreground">El bot debe ser administrador del canal privado.</span>
          </label>
          <Checkbox name="formAlertsEnabled" defaultChecked={settings.formAlertsEnabled} label={<span><span className="block font-medium">Fallos técnicos de formularios</span><span className="block text-xs text-muted-foreground">Ignora validaciones normales y reporta errores reales.</span></span>} />
          <Checkbox name="performanceAlertsEnabled" defaultChecked={settings.performanceAlertsEnabled} label={<span><span className="block font-medium">Operaciones lentas</span><span className="block text-xs text-muted-foreground">Sentry se encarga de medir y agrupar el rendimiento.</span></span>} />
          <label className="flex max-w-xs flex-col gap-1.5 text-sm">
            <span className="font-medium">Umbral de lentitud (ms)</span>
            <input name="slowOperationMs" type="number" min={1000} max={60000} step={100} defaultValue={settings.slowOperationMs} className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <Button type="submit" className="self-start" disabled={savePending}>{savePending ? "Guardando…" : "Guardar configuración"}</Button>
        </form>
        <form action={testAction}>
          <Button type="submit" variant="outline" disabled={testPending || !settings.telegramChatId}>{testPending ? "Enviando…" : "Enviar alerta de prueba"}</Button>
        </form>
        {saveState.success || testState.success ? <p role="status" className="text-sm text-muted-foreground">{saveState.success ?? testState.success}</p> : null}
        {saveState.error || testState.error ? <p role="alert" className="text-sm text-destructive">{saveState.error ?? testState.error}</p> : null}
      </section>
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <h2 className="font-heading font-medium">Cobertura</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Errores nuevos de frontend, servidor y API.</li>
          <li>Dos fallos consecutivos del endpoint de salud y recuperación.</li>
          <li>Escalamiento cuando un incidente se repite o aumenta su impacto.</li>
        </ul>
      </section>
    </div>
  );
}
