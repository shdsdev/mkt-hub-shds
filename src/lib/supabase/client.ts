import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser-side client — used for direct uploads (e.g. QR logos to Storage) so the binary never
// passes through our own server (Phase 5 design).
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
