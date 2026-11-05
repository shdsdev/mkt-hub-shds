import type { EmailContactStatus } from "./service";

export type EmailContactListOptions = {
  page: number;
  pageSize: number;
  search?: string;
  status?: EmailContactStatus;
  tagId?: string;
  segmentId?: string;
  source?: string;
  eventId?: string;
  sort: "name_asc" | "name_desc" | "updated_desc";
};

export function normalizeEmailContactListOptions(input: { page?: string; pageSize?: string; q?: string; search?: string; status?: string; tag?: string; tagId?: string; segment?: string; segmentId?: string; source?: string; event?: string; eventId?: string; sort?: string }): EmailContactListOptions {
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 25));
  const search = (input.q ?? input.search)?.trim() || undefined;
  const status = ["subscribed", "unsubscribed", "suppressed", "pending"].includes(input.status ?? "")
    ? input.status as EmailContactStatus
    : undefined;
  const sort = input.sort === "name_desc" || input.sort === "updated_desc" ? input.sort : "name_asc";
  return { page, pageSize, search, status, tagId: input.tagId || input.tag || undefined, segmentId: input.segmentId || input.segment || undefined, source: input.source || undefined, eventId: input.eventId || input.event || undefined, sort };
}
