import { notFound } from "next/navigation";
import { getPublishedEventBySlugPublic, recordEventVisit } from "@/modules/events";
import { RegisterForm } from "./register-form";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// spec.md "Acquisition Source Capture" — the public landing has no session, so UTM parameters
// are read straight off the URL (standard utm_* query convention) rather than through any
// taxonomy-validating helper in @/modules/utm; that module validates ADMIN-authored
// links/presets, not arbitrary traffic an anonymous visitor's referring ad/campaign may attach.
function readUtmFromSearchParams(searchParams: SearchParams) {
  return {
    utmSource: firstValue(searchParams.utm_source),
    utmMedium: firstValue(searchParams.utm_medium),
    utmCampaign: firstValue(searchParams.utm_campaign),
    utmTerm: firstValue(searchParams.utm_term),
    utmContent: firstValue(searchParams.utm_content),
    utmId: firstValue(searchParams.utm_id),
  };
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" });

function formatWhen(startsAt: Date, endsAt: Date | null): string {
  const day = dateFormatter.format(startsAt);
  const start = timeFormatter.format(startsAt);
  if (!endsAt) return `${day} · ${start}`;
  const sameDay = startsAt.toDateString() === endsAt.toDateString();
  const end = timeFormatter.format(endsAt);
  return sameDay ? `${day} · ${start} – ${end}` : `${day} ${start} – ${dateFormatter.format(endsAt)} ${end}`;
}

// spec.md "Public Landing Content Sections" (hero/agenda/location/form, no speakers) + "Event
// Lifecycle Status" (draft never publicly reachable) — getPublishedEventBySlugPublic's status
// filter is the only gate; a draft or unknown slug returns `undefined` here, same 404 shape as
// every other admin-gated page in this app (see app/(protected)/events/page.tsx).
//
// The dynamic segment is named `id` (not `slug`) purely because Next.js's App Router requires
// every route contributing to the same URL position to use the SAME param name across the whole
// app — route groups like `(protected)` are stripped from the URL, so this public page and
// `app/(protected)/events/[id]/edit` both resolve under `/events/...` and collide otherwise
// ("You cannot use different slug names for the same dynamic path"). The value itself is still
// the event's slug, not a UUID — only the folder/param name had to match.
export default async function EventLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id: slug } = await params;
  const event = await getPublishedEventBySlugPublic(slug);
  if (!event) notFound();

  // Fire-and-forget: a visit-count hiccup must never break the landing page itself (design.md
  // Open Questions, resolved in PR5 — see recordEventVisit's own rationale in service.ts).
  void recordEventVisit(slug).catch(() => {});

  const utm = readUtmFromSearchParams(await searchParams);
  const agenda = event.agenda ?? [];
  const sponsorLogos = event.sponsorLogos ?? [];

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-[#FBF7F1] font-sans text-[#201D1A]">
      {/* Ambient gel-light texture, not photography — three soft blurred color fields, the pinned
          reference's "blob" material rendered as the CSS gradient it actually is, never an SVG
          scene imitating one (craft-floor "Real illustration or none"). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle_at_30%_30%,#CFE1F6,transparent_70%)] blur-3xl" />
        <div className="absolute -right-24 top-10 size-[28rem] rounded-full bg-[radial-gradient(circle_at_60%_40%,#F7D6E3,transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 size-[30rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,#DCEEE2,transparent_70%)] blur-3xl" />
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-20 px-6 py-20 sm:px-10">
        {/* Hero — the thesis viewport: a cold visitor reads what this is, when, and acts. */}
        <section className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#201D1A]/10 bg-white/70 px-4 py-1.5 text-sm text-[#4A4740] backdrop-blur-sm">
            <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0" fill="none">
              <rect x="3" y="4.5" width="14" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {formatWhen(event.startsAt, event.endsAt)}
            {event.location ? ` · ${event.location}` : ""}
          </span>

          <h1 className="font-display text-5xl italic leading-[1.05] tracking-[-0.02em] sm:text-7xl">
            <span className="bg-gradient-to-r from-[#5C86C9] via-[#9F84C9] to-[#D98CA6] bg-clip-text text-transparent">
              {event.name}
            </span>
          </h1>

          {event.description ? (
            <p className="max-w-xl text-lg leading-relaxed text-[#4A4740]">{event.description}</p>
          ) : null}

          <a
            href="#registro"
            className="group mt-2 inline-flex items-center gap-2 rounded-full bg-[#201D1A] px-7 py-3.5 text-base font-medium text-[#FBF7F1] transition-colors hover:bg-[#3A3530]"
          >
            Registrarme
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 transition-transform group-hover:translate-x-0.5">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>

          {event.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset
            <img
              src={event.heroImageUrl}
              alt=""
              className="mt-4 h-72 w-full rounded-[2rem] object-cover shadow-[0_24px_60px_-20px_rgba(32,29,26,0.35)] sm:h-96"
            />
          ) : null}
        </section>

        {agenda.length > 0 ? (
          <section className="flex flex-col gap-6">
            <h2 className="font-display text-2xl italic">Agenda</h2>
            <ol className="flex flex-col">
              {agenda.map((item, index) => (
                <li
                  key={index}
                  className="flex items-baseline gap-6 border-t border-[#201D1A]/10 py-4 first:border-t-0"
                >
                  <span className="font-display w-28 shrink-0 text-base text-[#9F84C9]">{item.time}</span>
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-medium">{item.title}</span>
                    {item.description ? (
                      <span className="text-sm text-[#6B6A63]">{item.description}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {sponsorLogos.length > 0 ? (
          <section className="flex flex-col items-center gap-5 border-t border-[#201D1A]/10 pt-12">
            <p className="text-sm text-[#6B6A63]">Con el apoyo de</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
              {sponsorLogos.map((sponsor, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset
                <img
                  key={index}
                  src={sponsor.url}
                  alt={sponsor.name ?? ""}
                  className="h-8 w-auto opacity-70 grayscale transition-opacity hover:opacity-100 hover:grayscale-0"
                />
              ))}
            </div>
          </section>
        ) : null}

        <section id="registro" className="scroll-mt-10">
          <RegisterForm
            slug={event.slug}
            collectCompany={event.collectCompany}
            collectJobTitle={event.collectJobTitle}
            utm={utm}
          />
        </section>
      </main>
    </div>
  );
}
