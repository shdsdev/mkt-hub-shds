import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { listHcsConnections } from "@/modules/integrations";
import { getTelegramSettings } from "@/modules/notifications";
import { HcsIntegrations } from "./hcs-integrations";

export default async function IntegrationsSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const [connections, telegramSettings] = await Promise.all([
    listHcsConnections(user.profile.organizationId),
    getTelegramSettings(user.profile.organizationId),
  ]);
  return <HcsIntegrations connections={connections} telegramSettings={telegramSettings} />;
}
