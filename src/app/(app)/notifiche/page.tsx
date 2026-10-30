import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { displayName, type Notification } from "@/lib/types";
import { formatDateTime } from "@/components/ui";
import { clearRead, markAllRead } from "./actions";
import { PushToggle } from "@/components/push-toggle";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select(
      "id, type, task_id, comment_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, full_name, email), tasks(id, title)",
    )
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (data ?? []) as unknown as Notification[];
  const unread = items.filter((n) => !n.read_at).length;
  const hasRead = items.some((n) => n.read_at);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifiche</h1>
          <p className="text-sm text-muted">
            {unread ? `${unread} da leggere` : "Sei in pari."}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <form action={markAllRead}>
              <button className="btn-ghost">Segna tutte come lette</button>
            </form>
          )}
          {hasRead && (
            <form action={clearRead}>
              <button className="btn-ghost">Elimina lette</button>
            </form>
          )}
        </div>
      </div>

      <PushToggle />

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Nessuna notifica. Qui arrivano i nuovi task assegnati e le menzioni nei commenti.
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((n) => {
            const who = n.actor ? displayName(n.actor) : "Qualcuno";
            const title = n.tasks?.title ?? "un task eliminato";
            const href = n.task_id
              ? `/task/${n.task_id}${n.comment_id ? `#c-${n.comment_id}` : ""}`
              : "/notifiche";
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className={`flex gap-3 px-4 py-3 transition hover:bg-stone-50 ${n.read_at ? "" : "bg-brand/5"}`}
                >
                  <span className="mt-0.5 text-lg" aria-hidden>
                    {n.type === "mention" ? "💬" : "📋"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">
                      {n.type === "mention" ? (
                        <>
                          <b>{who}</b> ti ha menzionato in <b>{title}</b>
                        </>
                      ) : (
                        <>
                          <b>{who}</b> ti ha assegnato <b>{title}</b>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-muted">{formatDateTime(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Non letta" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
