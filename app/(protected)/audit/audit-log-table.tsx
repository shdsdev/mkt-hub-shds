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

function Row({ log }: { log: AuditLogRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = log.before !== null || log.after !== null;

  return (
    <>
      <tr
        className={`border-b border-border text-sm ${hasDiff ? "cursor-pointer hover:bg-card" : ""}`}
        onClick={() => hasDiff && setExpanded((open) => !open)}
      >
        <td className="py-2 pr-4">{log.action}</td>
        <td className="py-2 pr-4 text-muted-foreground">{log.resourceType}</td>
        <td className="py-2 pr-4">{log.who}</td>
        <td className="py-2 pr-4 text-muted-foreground">{log.when}</td>
        <td className="py-2 text-muted-foreground">{hasDiff ? (expanded ? "▾" : "▸") : ""}</td>
      </tr>
      {expanded && hasDiff && (
        <tr className="border-b border-border bg-card">
          <td colSpan={5} className="p-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="mb-1 font-medium text-muted-foreground">Before</p>
                <pre className="overflow-x-auto rounded-md bg-background p-2">
                  {log.before ? JSON.stringify(log.before, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-medium text-muted-foreground">After</p>
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
    return <p className="text-sm text-muted-foreground">No audit activity yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Action</th>
            <th className="py-2 pr-4 font-medium">Resource</th>
            <th className="py-2 pr-4 font-medium">Who</th>
            <th className="py-2 pr-4 font-medium">When</th>
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
