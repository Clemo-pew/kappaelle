"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function markAllRead() {
  const me = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", me.id)
    .is("read_at", null);
  revalidatePath("/notifiche");
}

export async function clearRead() {
  const me = await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("user_id", me.id).not("read_at", "is", null);
  revalidatePath("/notifiche");
}
