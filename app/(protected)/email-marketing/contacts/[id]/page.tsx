import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEmailContact, listEmailContactDetails, listEmailTags } from "@/modules/email-marketing";
import { ContactProfile } from "./contact-profile";

export default async function EmailContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();
  const { id } = await params;
  const [contact, details, tags] = await Promise.all([
    getEmailContact({ organizationId: user.profile.organizationId, contactId: id }),
    listEmailContactDetails(user.profile.organizationId),
    listEmailTags(user.profile.organizationId),
  ]);
  if (!contact) notFound();

  return <ContactProfile contact={contact} detail={details[contact.id] ?? { tags: [], events: [] }} tags={tags} />;
}
