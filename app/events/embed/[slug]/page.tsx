import { getPublishedEventBySlugPublic, resolveRegistrationFormConfig } from "@/modules/events";
import { RegisterForm } from "../../[id]/register-form";
import { ResizeBridge } from "./resize-bridge";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

export default async function EmbedEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const event = await getPublishedEventBySlugPublic(slug);

  if (!event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6 text-center text-sm text-[#4a4a4a]">
        Este formulario ya no está disponible.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] p-4 font-sans text-[#202020] sm:p-6">
      <ResizeBridge />
      <RegisterForm
        slug={event.slug}
        formConfig={resolveRegistrationFormConfig(event)}
        utm={readUtmFromSearchParams(await searchParams)}
      />
    </main>
  );
}
