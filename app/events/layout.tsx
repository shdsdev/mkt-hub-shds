import { Fraunces } from "next/font/google";

// Public-facing surfaces only (landing, registration, self-cancel) — a different visual world
// from the dark Operate admin behind app/(protected), on purpose: attendees never see that UI.
// A nested layout may add providers/fonts without re-declaring <html>/<body> (owned by the root
// layout); this only contributes the font variable the landing's display headline reads.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500", "600"],
});

// This surface authors every color as an explicit Tailwind utility rather than the admin theme's
// `bg-background`/`text-foreground` tokens, since those resolve dark (the root layout always adds
// `.dark` to <html>) and there is no `.light` counterpart in globals.css to override it with.
export default function EventsPublicLayout({ children }: { children: React.ReactNode }) {
  return <div className={fraunces.variable}>{children}</div>;
}
