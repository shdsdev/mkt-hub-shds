import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { OrgDashboard } from "./org-dashboard";

// Thin server shell — auth check only. OrgDashboard owns its own date range / surface state and
// fetches from /analytics/data itself, same posture as EventAnalyticsPanel.
export default async function AnalyticsDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl">
      <OrgDashboard />
    </div>
  );
}
