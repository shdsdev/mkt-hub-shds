// Public surface of the `audit` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  recordAudit,
  listAuditLogs,
  checkRateLimit,
  type AuditLog,
  type AuditAction,
  type RecordAuditInput,
} from "./service";
