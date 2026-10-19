import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { listUserNotifications } from "@/modules/notifications";
import { markNotificationReadAction } from "./actions";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return null;
  const notifications = await listUserNotifications({ userId: user.id, organizationId: user.profile.organizationId });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Marketing Hub</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notificaciones</h1>
      </div>
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <Bell className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No tenés notificaciones nuevas</p>
          <p className="text-sm text-muted-foreground">Las solicitudes de tus eventos aparecerán acá.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <article key={notification.id} className={`rounded-xl border p-4 ${notification.readAt ? "border-border bg-card/40" : "border-primary/40 bg-primary/5"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-medium">{notification.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={notification.createdAt.toISOString()}>
                  {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(notification.createdAt)}
                </time>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href={notification.href} className="text-sm font-medium text-primary underline underline-offset-4">
                  Revisar solicitud
                </Link>
                {!notification.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                      <Check className="size-4" aria-hidden="true" />
                      Marcar como leída
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
