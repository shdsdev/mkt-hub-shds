export type ResourceStatus = "active" | "disabled" | "archived";

// "archived" keeps resolving — a printed QR must survive being archived out of active management
// view (Phase 6 design, docs/superpowers/specs/2026-09-09-phase6-campaigns-print-runs-design.md).
// Only "disabled" (deliberate takedown: abuse, legal, operator error) blocks the redirect.
export function isResolvable(status: ResourceStatus): boolean {
  return status !== "disabled";
}
