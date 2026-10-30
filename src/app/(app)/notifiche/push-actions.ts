"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function savePushSubscription(sub: Sub, userAgent: string) {
  const me = await requireUser();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { error: "Iscrizione non valida." };
  }
  const sb = createAdminClient();
  // Se lo stesso dispositivo era associato a un altro utente (telefono condiviso), lo riassegno
  await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await sb.from("push_subscriptions").insert({
    user_id: me.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const me = await requireUser();
  const sb = createAdminClient();
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", me.id);
  return { ok: true };
}

export async function sendTestPush() {
  const me = await requireUser();
  await sendPush([me.id], {
    title: "Notifiche attive ✓",
    body: "Da ora riceverai qui i nuovi task e le menzioni.",
    url: "/notifiche",
    tag: "test",
  });
  return { ok: true };
}
