import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseServiceKey } from "@/lib/env";

export type PushMessage = { title: string; body: string; url: string; tag?: string };

let configured: boolean | null = null;

function configure() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";
  if (!pub || !priv || !supabaseServiceKey()) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Invia una notifica push a tutti i dispositivi degli utenti indicati.
 * Include il numero di notifiche non lette per aggiornare il badge sull'icona.
 * Non lancia mai errori: le notifiche push sono "best effort".
 */
export async function sendPush(userIds: string[], message: PushMessage) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length || !configure()) return;

  try {
    const sb = createAdminClient();
    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", ids);
    if (!subs?.length) return;

    const unread = new Map<string, number>();
    await Promise.all(
      ids.map(async (uid) => {
        const { count } = await sb
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .is("read_at", null);
        unread.set(uid, count ?? 0);
      }),
    );

    const expired: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        const payload = JSON.stringify({ ...message, unread: unread.get(s.user_id as string) ?? 0 });
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
            payload,
            { TTL: 60 * 60 * 24, urgency: "normal" },
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          // dispositivo disiscritto o abbonamento scaduto: lo rimuovo
          if (code === 404 || code === 410) expired.push(s.id as string);
          else console.error("[push] invio fallito:", code, (err as Error).message);
        }
      }),
    );

    if (expired.length) await sb.from("push_subscriptions").delete().in("id", expired);
  } catch (e) {
    console.error("[push] errore:", e);
  }
}
