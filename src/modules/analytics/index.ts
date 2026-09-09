// Public surface of the `analytics` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export { trackRedirect, countEventsForShortLink, countEventsForQrCode } from "./service";
export { resolveVisitor } from "./visitor";
