import { notFound } from "next/navigation";
import { getPublishedEventBySlugPublic } from "@/modules/events";
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

// spec.md "Public Landing Content Sections" (hero/agenda/location/form, no speakers) + "Event
// Lifecycle Status" (draft never publicly reachable) — getPublishedEventBySlugPublic's status
// filter is the only gate; a draft or unknown slug returns `undefined` here, same 404 shape as
// every other admin-gated page in this app (see app/(protected)/events/page.tsx).
export default async function EventLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const event = await getPublishedEventBySlugPublic(slug);
  if (!event) notFound();

  const utm = readUtmFromSearchParams(await searchParams);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <section className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">{event.name}</h1>
        {event.description ? <p className="text-muted-foreground">{event.description}</p> : null}
      </section>

      <section className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm">
        <p>
          <span className="font-medium">Cuándo: </span>
          {event.startsAt.toLocaleString()}
          {event.endsAt ? ` – ${event.endsAt.toLocaleString()}` : ""}
        </p>
        {event.location ? (
          <p>
            <span className="font-medium">Dónde: </span>
            {event.location}
          </p>
        ) : null}
      </section>

      <RegisterForm
        slug={event.slug}
        collectCompany={event.collectCompany}
        collectJobTitle={event.collectJobTitle}
        utm={utm}
      />
    </div>
  );
}
