// Public surface of the `events` module — the ONLY file other modules may import
// (ARCHITECTURE.md I-4). CRUD, registration, and check-in service functions land in later PRs
// (tasks.md Phase 2-5); this PR exposes only the primitives other code may need before then.
export { generateBackupCode, generateOpaqueToken, normalizeEmail } from "./service";
