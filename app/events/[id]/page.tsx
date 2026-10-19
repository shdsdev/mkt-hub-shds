import { notFound } from "next/navigation";
import { getPublishedEventBySlugPublic, recordEventVisit, resolveRegistrationFormConfig } from "@/modules/events";
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

// Reference: https://yukohealth-storefront-v1.21st.app/ — live-inspected computed styles, not a
// screenshot guess. Grammar carried over 1:1: pill nav row, a small (28px/400) Inter headline
// clipped to a 3-stop 105deg gradient, one large 40px-radius hero image with floating white
// overlay cards on top of it, then a clean white card grid below — mapped onto this page's actual
// content (date/location pills, agenda-as-cards, sponsors) rather than a literal product catalog.
const GRADIENT_TEXT =
  "bg-[linear-gradient(105deg,#0077b8_1%,#7d66b0_48%,#d0617b_99%)] bg-clip-text text-transparent";

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
  const when = formatWhen(event.startsAt, event.endsAt);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-[#202020]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <span className="inline-flex items-center rounded-full bg-[#F0F0F0] px-4 py-2 text-sm text-[#202020]">
          {when}
        </span>
        <span className="text-sm font-medium tracking-tight">{event.name}</span>
        <a
          href="#registro"
          className="inline-flex items-center rounded-full bg-[#202020] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3a3a3a]"
        >
          Registrarme
        </a>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-24 px-6 pb-24 sm:px-10">
        {/* Hero — understated gradient tagline over one large image, floating cards for the facts
            a cold visitor needs (when/where, what this is), matching the reference's composition
            exactly instead of a big bold serif headline. */}
        <section className="flex flex-col items-center pt-6">
          <h1
            className={`mx-auto mb-12 w-fit text-center font-sans text-[28px] leading-8 font-normal tracking-[-0.04em] sm:mb-16 ${GRADIENT_TEXT}`}
          >
            {event.name}
          </h1>

          <div className="relative w-full">
            {event.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset
              <img
                src={event.heroImageUrl}
                alt=""
                className="h-[22rem] w-full rounded-[40px] object-cover sm:h-[30rem]"
              />
            ) : (
              <div className="h-[22rem] w-full rounded-[40px] bg-[linear-gradient(135deg,#eef2f6_0%,#f3edf3_50%,#fbeef1_100%)] sm:h-[30rem]" />
            )}

            {event.location ? (
              <div className="absolute left-4 top-4 flex max-w-[16rem] items-center rounded-2xl bg-white px-4 py-3 text-sm text-[#202020] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] sm:left-8 sm:top-8">
                {event.location}
              </div>
            ) : null}

            {event.description ? (
              <div className="absolute bottom-4 right-4 max-w-sm rounded-2xl bg-white px-5 py-4 text-center text-sm leading-relaxed text-[#4a4a4a] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] sm:bottom-8 sm:right-8">
                {event.description}
              </div>
            ) : null}
          </div>
        </section>

        {agenda.length > 0 ? (
          <section className="flex flex-col gap-8">
            <h2 className="font-sans text-xl font-medium tracking-tight">Agenda</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {agenda.map((item, index) => (
                <div
                  key={index}
                  className="relative flex min-h-[220px] flex-col justify-between rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5"
                >
                  <span className="absolute right-5 top-5 rounded-full bg-[#F0F0F0] px-3 py-1 text-xs text-[#4a4a4a]">
                    {item.time}
                  </span>
                  <div className="mt-10 flex flex-col gap-2">
                    <span className="text-base font-medium">{item.title}</span>
                    {item.description ? (
                      <span className="text-sm leading-relaxed text-[#6b6b6b]">{item.description}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sponsorLogos.length > 0 ? (
          <section className="flex flex-col items-center gap-5 border-t border-black/[0.06] pt-16">
            <p className="text-sm text-[#6b6b6b]">Con el apoyo de</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
              {sponsorLogos.map((sponsor, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset
                <img
                  key={index}
                  src={sponsor.url}
                  alt={sponsor.name ?? ""}
                  className="h-8 w-auto opacity-60 grayscale transition-opacity hover:opacity-100 hover:grayscale-0"
                />
              ))}
            </div>
          </section>
        ) : null}

        <section id="registro" className="mx-auto w-full max-w-2xl scroll-mt-10">
          <RegisterForm
            slug={event.slug}
             formConfig={resolveRegistrationFormConfig(event)}
            utm={utm}
          />
        </section>
      </main>
    </div>
  );
}
