// Public-facing surfaces only (landing, registration, self-cancel) — a different visual world
// from the dark Operate admin behind app/(protected), on purpose: attendees never see that UI.
// Uses the app's existing --font-sans (Inter, see globals.css @theme inline) with no surface-
// specific font: the reference this redesign matches (YukoHealth storefront) runs Inter
// throughout, no serif — so unlike the first pass of this redesign, nothing extra is loaded here.
export default function EventsPublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#FAFAFA] text-[#202020]">{children}</div>;
}
