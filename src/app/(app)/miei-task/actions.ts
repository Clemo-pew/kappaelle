"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type ProgressState = { ok?: boolean; error?: string };

export async function updateMyProgress(_prev: ProgressState, formData: FormData): Promise<ProgressState> {
  const me = await requireUser();
  const taskId = String(formData.get("task_id") ?? "");
  const raw = Number(formData.get("progress"));
  const note = String(formData.get("note") ?? "").slice(0, 2000);

  if (!taskId) return { error: "Task non valido." };
  if (!Number.isFinite(raw)) return { error: "Percentuale non valida." };
  const progress = Math.round(Math.min(100, Math.max(0, raw)));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_assignees")
    .update({ progress, note })
    .eq("task_id", taskId)
    .eq("user_id", me.id)
    .select("task_id");

  if (error) return { error: "Salvataggio non riuscito: " + error.message };
  if (!data?.length) return { error: "Non sei assegnato a questo task." };

  revalidatePath("/miei-task");
  revalidatePath("/admin");
  return { ok: true };
}
