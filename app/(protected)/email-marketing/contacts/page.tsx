import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { listEmailContacts, listEmailSegments, listEmailTags, normalizeEmailContactListOptions } from "@/modules/email-marketing";
import { ContactWorkspace } from "./contact-workspace";

const statusLabels = {
  subscribed: "Suscrito",
  unsubscribed: "Dado de baja",
  suppressed: "Suprimido",
  pending: "Pendiente",
} as const;

export default async function EmailContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();
  const rawSearchParams = await searchParams;
  const values = Object.fromEntries(Object.entries(rawSearchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const options = normalizeEmailContactListOptions(values);

  const [contacts, tags, segments] = await Promise.all([
    listEmailContacts(user.profile.organizationId, options),
    listEmailTags(user.profile.organizationId),
    listEmailSegments(user.profile.organizationId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10">
      <ContactWorkspace contacts={contacts.rows} total={contacts.total} page={contacts.page} pageSize={contacts.pageSize} filter={options} tags={tags} segments={segments} statusLabels={statusLabels} />
    </main>
  );
}
