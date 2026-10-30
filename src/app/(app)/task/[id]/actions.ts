"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { MENTION_RE } from "@/lib/types";

export type CommentState = { ok?: boolean; error?: string; nonce?: number };

export async function addComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const me = await requireUser();
  const taskId = String(formData.get("task_id") ?? "");
  let body = String(formData.get("body") ?? "").trim();

  if (!taskId) return { error: "Task non valido." };
  if (!body) return { error: "Scrivi qualcosa." };
  if (body.length > 5000) return { error: "Commento troppo lungo (max 5000 caratteri)." };

  const supabase = await createClient();

  // Menzioni: verifico che gli utenti esistano e riscrivo il nome con quello reale
  const ids = [...new Set([...body.matchAll(MENTION_RE)].map((m) => m[2]))];
  const valid = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids)
      .eq("active", true);
    for (const p of data ?? []) valid.set(p.id as string, (p.full_name as string) || (p.email as string));
  }
  body = body.replace(MENTION_RE, (_m, name: string, id: string) =>
    valid.has(id) ? `@[${valid.get(id)}](${id})` : `@${name}`,
  );

  const { data: comment, error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: me.id, body })
    .select("id")
    .single();
  if (error) return { error: "Commento non salvato: " + error.message };

  const toNotify = [...valid.keys()].filter((id) => id !== me.id);
  if (toNotify.length) {
    const { error: mErr } = await supabase
      .from("comment_mentions")
      .insert(toNotify.map((user_id) => ({ comment_id: comment.id, user_id })));
    if (mErr) return { error: "Commento salvato, ma le menzioni non sono state inviate: " + mErr.message };

    const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).maybeSingle();
    const plain = body.replace(MENTION_RE, (_m, name: string) => `@${name}`).replace(/\s+/g, " ");
    const excerpt = plain.length > 120 ? plain.slice(0, 117) + "…" : plain;
    after(() =>
      sendPush(toNotify, {
        title: `${me.full_name || "Un collega"} ti ha menzionato`,
        body: `${task?.title ? `${task.title}: ` : ""}${excerpt}`,
        url: `/task/${taskId}#c-${comment.id}`,
        tag: `comment-${comment.id}`,
      }),
    );
  }

  revalidatePath(`/task/${taskId}`);
  return { ok: true, nonce: Date.now() };
}

export async function deleteComment(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  const supabase = await createClient();
  await supabase.from("task_comments").delete().eq("id", id);
  revalidatePath(`/task/${taskId}`);
}
