"use client";

import { useState } from "react";

export type AuditLogRow = {
  id: string;
  action: string;
  resourceType: string;
  who: string;
  when: string;
  before: unknown;
  after: unknown;
};

const ACTION_LABEL: Record<string, string> = {
  create: "crear",
  destination_change: "cambio de destino",
  archive: "archivar",
  end_campaign: "finalizar campaña",
  record_print_run: "registrar tirada",
};

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  link: "enlace",
  short_link: "enlace corto",
  qr_code: "código QR",
  campaign: "campaña",
  domain: "dominio",
  print_run: "tirada",
  utm_preset: "preajuste UTM",
};

function Row({ log }: { log: AuditLogRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = log.before !== null || log.after !== null;

  return (
    <>
      <tr
        className={`border-b border-border text-sm ${hasDiff ? "cursor-pointer hover:bg-card" : ""}`}
        onClick={() => hasDiff && setExpanded((open) => !open)}
      >
        <td className="py-2 pr-4">{ACTION_LABEL[log.action] ?? log.action}</td>
        <td className="py-2 pr-4 text-muted-foreground">
          {RESOURCE_TYPE_LABEL[log.resourceType] ?? log.resourceType}
        </td>
        <td className="py-2 pr-4">{log.who}</td>
        <td className="py-2 pr-4 text-muted-foreground">{log.when}</td>
        <td className="py-2 text-muted-foreground">{hasDiff ? (expanded ? "▾" : "▸") : ""}</td>
      </tr>
      {expanded && hasDiff && (
        <tr className="border-b border-border bg-card">
          <td colSpan={5} className="p-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="mb-1 font-medium text-muted-foreground">Antes</p>
                <pre className="overflow-x-auto rounded-md bg-background p-2">
                  {log.before ? JSON.stringify(log.before, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-medium text-muted-foreground">Después</p>
                <pre className="overflow-x-auto rounded-md bg-background p-2">
                  {log.after ? JSON.stringify(log.after, null, 2) : "—"}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AuditLogTable({ logs }: { logs: AuditLogRow[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aún no hay actividad de auditoría.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Acción</th>
            <th className="py-2 pr-4 font-medium">Recurso</th>
            <th className="py-2 pr-4 font-medium">Quién</th>
            <th className="py-2 pr-4 font-medium">Cuándo</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <Row key={log.id} log={log} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
