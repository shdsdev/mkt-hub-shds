import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { domains, folders, tags, linkTags, links, shortLinks } from "./db";
import { isValidSlug, generateSlug } from "./slug";
import { isResolvable } from "./resource-status";

export type Link = typeof links.$inferSelect;
export type ShortLink = typeof shortLinks.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type Tag = typeof tags.$inferSelect;

const destinationUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "Destination must start with http:// or https://.",
  });

export type CreateLinkInput = {
  organizationId: string;
  destinationUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  folderId?: string;
};

export async function createLink(input: CreateLinkInput): Promise<Link> {
  const destinationUrl = destinationUrlSchema.parse(input.destinationUrl);
  const [link] = await db
    .insert(links)
    .values({ ...input, destinationUrl })
    .returning();
  return link;
}

// The only place a link's destination is ever written after creation — ARCHITECTURE.md I-1.
// Never touches short_links or qr_codes.
export async function updateLinkDestination(linkId: string, destinationUrl: string): Promise<Link> {
  const validated = destinationUrlSchema.parse(destinationUrl);
  const [link] = await db
    .update(links)
    .set({ destinationUrl: validated })
    .where(eq(links.id, linkId))
    .returning();
  return link;
}

export async function getLink(linkId: string): Promise<Link | undefined> {
  const rows = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
  return rows[0];
}

export async function listLinks(organizationId: string): Promise<Link[]> {
  return db.select().from(links).where(eq(links.organizationId, organizationId));
}

// No hard-delete anywhere (I-7) — this is the only lifecycle action a link has. Never touches
// tracking_events/print_runs history.
export async function archiveLink(linkId: string): Promise<Link> {
  const [link] = await db
    .update(links)
    .set({ status: "archived" })
    .where(eq(links.id, linkId))
    .returning();
  return link;
}

export async function archiveShortLink(shortLinkId: string): Promise<ShortLink> {
  const [shortLink] = await db
    .update(shortLinks)
    .set({ status: "archived" })
    .where(eq(shortLinks.id, shortLinkId))
    .returning();
  return shortLink;
}

export type CreateShortLinkInput = {
  organizationId: string;
  linkId: string;
  domainId: string;
  slug?: string;
};

const MAX_SLUG_RETRIES = 3;

export async function createShortLink(input: CreateShortLinkInput): Promise<ShortLink> {
  if (input.slug) {
    if (!isValidSlug(input.slug)) {
      throw new Error("Slug must be 3-64 characters: letters, digits, _ or -.");
    }
    return insertShortLink({ ...input, slug: input.slug });
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    try {
      return await insertShortLink({ ...input, slug: generateSlug() });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not generate a unique slug after ${MAX_SLUG_RETRIES} attempts.`,
    { cause: lastError },
  );
}

async function insertShortLink(input: CreateShortLinkInput & { slug: string }): Promise<ShortLink> {
  const [shortLink] = await db
    .insert(shortLinks)
    .values({
      organizationId: input.organizationId,
      linkId: input.linkId,
      domainId: input.domainId,
      slug: input.slug,
    })
    .returning();
  return shortLink;
}

export async function listShortLinksForLink(linkId: string): Promise<ShortLink[]> {
  return db.select().from(shortLinks).where(eq(shortLinks.linkId, linkId));
}

export async function listShortLinksForOrganization(organizationId: string): Promise<ShortLink[]> {
  return db.select().from(shortLinks).where(eq(shortLinks.organizationId, organizationId));
}

// Destination + UTM only — never anything request-supplied (open-redirect mitigation,
// ARCHITECTURE.md threat matrix).
export function buildDestinationUrl(link: Link): string {
  const url = new URL(link.destinationUrl);
  const utmEntries: [string, string | null][] = [
    ["utm_source", link.utmSource],
    ["utm_medium", link.utmMedium],
    ["utm_campaign", link.utmCampaign],
    ["utm_term", link.utmTerm],
    ["utm_content", link.utmContent],
  ];
  for (const [key, value] of utmEntries) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export type ResolvedShortLink = { link: Link; shortLink: ShortLink };

// The redirect engine's one lookup (ARCHITECTURE.md §25) — never a default-domain fallback if
// either half doesn't match.
export async function resolveShortLinkByHostAndSlug(
  hostname: string,
  slug: string,
): Promise<ResolvedShortLink | undefined> {
  if (!isValidSlug(slug)) return undefined;

  const domainRows = await db.select().from(domains).where(eq(domains.hostname, hostname)).limit(1);
  const domain = domainRows[0];
  if (!domain) return undefined;

  const shortLinkRows = await db
    .select()
    .from(shortLinks)
    .where(and(eq(shortLinks.domainId, domain.id), eq(shortLinks.slug, slug)))
    .limit(1);
  const shortLink = shortLinkRows[0];
  if (!shortLink || !isResolvable(shortLink.status)) return undefined;

  const link = await getLink(shortLink.linkId);
  if (!link) return undefined;

  return { link, shortLink };
}

export async function listDomains(organizationId: string): Promise<Domain[]> {
  return db.select().from(domains).where(eq(domains.organizationId, organizationId));
}

export async function createDomain(organizationId: string, hostname: string): Promise<Domain> {
  const [domain] = await db.insert(domains).values({ organizationId, hostname }).returning();
  return domain;
}

export async function getDomain(id: string): Promise<Domain | undefined> {
  const rows = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
  return rows[0];
}

export async function getShortLink(id: string): Promise<ShortLink | undefined> {
  const rows = await db.select().from(shortLinks).where(eq(shortLinks.id, id)).limit(1);
  return rows[0];
}

export async function listFolders(organizationId: string): Promise<Folder[]> {
  return db.select().from(folders).where(eq(folders.organizationId, organizationId));
}

export async function createFolder(organizationId: string, name: string): Promise<Folder> {
  const [folder] = await db.insert(folders).values({ organizationId, name }).returning();
  return folder;
}

export async function listTags(organizationId: string): Promise<Tag[]> {
  return db.select().from(tags).where(eq(tags.organizationId, organizationId));
}

export async function getOrCreateTag(organizationId: string, name: string): Promise<Tag> {
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.organizationId, organizationId), eq(tags.name, name)))
    .limit(1);
  if (existing[0]) return existing[0];

  const [tag] = await db.insert(tags).values({ organizationId, name }).returning();
  return tag;
}

export async function tagLink(linkId: string, tagId: string): Promise<void> {
  await db.insert(linkTags).values({ linkId, tagId }).onConflictDoNothing();
}
