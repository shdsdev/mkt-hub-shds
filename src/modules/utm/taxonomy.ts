// Typed source/medium catalogs for the UTM template manager. Data records keep the selectable
// taxonomy decoupled from the UI: new-template controls read only `active` entries, while
// `deprecated` entries remain readable (never selectable) so legacy templates still display their
// original values.
export type TaxonomyStatus = "active" | "deprecated";

export type TaxonomyOption = {
  /** Canonical lowercase snake_case value persisted for new writes. */
  value: string;
  /** Human-readable label shown in selectors. */
  label: string;
  /** Grouping used for categorized search/filtering. */
  category: string;
  status: TaxonomyStatus;
  /** Alternative spellings / historical names that should still match search. */
  aliases?: string[];
  /** Medium values this source is recommended to pair with (warning-only, never blocking). */
  recommendedWith?: string[];
};

export const SOURCE_OPTIONS: TaxonomyOption[] = [
  {
    value: "google",
    label: "Google Ads",
    category: "search",
    status: "active",
    aliases: ["google_ads", "gads", "adwords"],
    recommendedWith: ["cpc", "paid_search"],
  },
  {
    value: "bing",
    label: "Bing Ads",
    category: "search",
    status: "active",
    aliases: ["bing_ads"],
    recommendedWith: ["cpc", "paid_search"],
  },
  {
    value: "facebook",
    label: "Facebook",
    category: "social",
    status: "active",
    aliases: ["fb", "meta"],
    recommendedWith: ["social", "paid_social"],
  },
  {
    value: "instagram",
    label: "Instagram",
    category: "social",
    status: "active",
    aliases: ["ig"],
    recommendedWith: ["social", "paid_social"],
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    category: "social",
    status: "active",
    aliases: ["li"],
    recommendedWith: ["social", "paid_social"],
  },
  {
    value: "tiktok",
    label: "TikTok",
    category: "social",
    status: "active",
    recommendedWith: ["social", "paid_social"],
  },
  {
    value: "youtube",
    label: "YouTube",
    category: "social",
    status: "active",
    recommendedWith: ["video"],
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    category: "social",
    status: "active",
    recommendedWith: ["social"],
  },
  {
    value: "newsletter",
    label: "Newsletter",
    category: "email",
    status: "active",
    aliases: ["email", "mail"],
    recommendedWith: ["email"],
  },
  {
    value: "direct",
    label: "Direct",
    category: "direct",
    status: "active",
    recommendedWith: ["none"],
  },
  {
    value: "referral",
    label: "Referral",
    category: "referral",
    status: "active",
    recommendedWith: ["referral"],
  },
  { value: "partner", label: "Partner", category: "partner", status: "active" },
  { value: "external", label: "External", category: "external", status: "active" },
  // Legacy kebab-case value — retained for display of historical templates, never selectable.
  { value: "facebook-ads", label: "Facebook Ads (legacy)", category: "social", status: "deprecated" },
];

export const MEDIUM_OPTIONS: TaxonomyOption[] = [
  {
    value: "cpc",
    label: "CPC",
    category: "paid",
    status: "active",
    aliases: ["ppc", "paid_search"],
  },
  { value: "paid_search", label: "Paid Search", category: "paid", status: "active" },
  { value: "paid_social", label: "Paid Social", category: "paid", status: "active" },
  {
    value: "social",
    label: "Social",
    category: "social",
    status: "active",
    aliases: ["social_post", "organic_social"],
  },
  { value: "email", label: "Email", category: "email", status: "active" },
  { value: "banner", label: "Banner", category: "display", status: "active", aliases: ["display"] },
  { value: "video", label: "Video", category: "video", status: "active" },
  { value: "organic", label: "Organic", category: "social", status: "active" },
  { value: "referral", label: "Referral", category: "referral", status: "active", aliases: ["affiliate"] },
  { value: "affiliate", label: "Affiliate", category: "referral", status: "active" },
  { value: "qr", label: "QR Code", category: "other", status: "active" },
  { value: "none", label: "None", category: "direct", status: "active" },
  // Legacy kebab-case medium — retained for display only.
  { value: "social-post", label: "Social Post (legacy)", category: "social", status: "deprecated" },
];

export function getActiveTaxonomyOptions(options: TaxonomyOption[]): TaxonomyOption[] {
  return options.filter((option) => option.status === "active");
}

export function getDeprecatedTaxonomyOptions(options: TaxonomyOption[]): TaxonomyOption[] {
  return options.filter((option) => option.status === "deprecated");
}

function matchesQuery(option: TaxonomyOption, normalizedQuery: string): boolean {
  const haystack = [option.value, option.label, ...(option.aliases ?? [])].map((text) =>
    text.toLowerCase(),
  );
  return haystack.some((text) => text.includes(normalizedQuery));
}

// Search across active options only — deprecated legacy values must never be suggested for new
// templates (spec: deprecated values MUST NOT be selectable or suggested).
export function searchTaxonomyOptions(options: TaxonomyOption[], query: string): TaxonomyOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return getActiveTaxonomyOptions(options);
  return getActiveTaxonomyOptions(options).filter((option) => matchesQuery(option, normalizedQuery));
}

// Full-catalog lookup (any status) — used when validating a value the user already typed.
export function findTaxonomyOption(
  options: TaxonomyOption[],
  value: string,
): TaxonomyOption | undefined {
  return options.find((option) => option.value === value);
}

// Active-only lookup — the gate for whether a submitted value is an approved, selectable choice.
export function findActiveTaxonomyOption(
  options: TaxonomyOption[],
  value: string,
): TaxonomyOption | undefined {
  const found = findTaxonomyOption(options, value);
  return found && found.status === "active" ? found : undefined;
}

export function isActiveTaxonomyValue(options: TaxonomyOption[], value: string): boolean {
  return findActiveTaxonomyOption(options, value) !== undefined;
}

export function getRecommendedMediumsForSource(source: string): string[] {
  return findTaxonomyOption(SOURCE_OPTIONS, source)?.recommendedWith ?? [];
}
