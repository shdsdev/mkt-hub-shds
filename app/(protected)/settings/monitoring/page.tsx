import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getMonitoringSettings } from "@/modules/monitoring";
import { MonitoringSettingsForm } from "./monitoring-settings";

export default async function MonitoringSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading font-medium">Monitoreo</h2>
        <p className="text-sm text-muted-foreground">Supervisá la salud, los errores y el rendimiento de toda la plataforma.</p>
      </div>
      <MonitoringSettingsForm settings={await getMonitoringSettings()} />
    </section>
  );
}
