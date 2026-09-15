import { createBrowserClient } from "@supabase/ssr";

// Browser-side client — used for direct uploads (e.g. QR logos to Storage) so the binary never
// passes through our own server (Phase 5 design).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
