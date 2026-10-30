import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/data";
import { TASK_SELECT, displayName, taskProgress, type Comment, type Task } from "@/lib/types";
import { DueDate, PriorityBadge, ProgressBar, formatDateTime } from "@/components/ui";
import { LinkList } from "@/components/links";
import { CommentBody } from "@/components/comment-body";
import { ConfirmButton } from "@/components/confirm-button";
import { ProgressEditor } from "@/app/(app)/miei-task/progress-editor";
import { CommentBox } from "./comment-box";
import { deleteComment } from "./actions";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const isAdmin = me.role === "admin";
  const supabase = await createClient();

  const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const task = data as unknown as Task;

  const [{ data: commentRows }, people] = await Promise.all([
    supabase
      .from("task_comments")
      .select("id, task_id, author_id, body, created_at, profiles!task_comments_author_id_fkey(id, full_name, email)")
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
    getEmployees(true),
    // Aprendo il task, le sue notifiche diventano lette
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", me.id)
      .eq("task_id", id)
      .is("read_at", null),
  ]);
  const comments = (commentRows ?? []) as unknown as Comment[];

  const mine = task.task_assignees.find((a) => a.user_id === me.id);
  const pct = taskProgress(task);
  const mentionable = people.filter((p) => p.id !== me.id).map((p) => ({ id: p.id, name: displayName(p) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <div>
          <Link href={isAdmin ? "/admin" : "/miei-task"} className="text-sm text-muted hover:text-ink">
            ← {isAdmin ? "Tutti i task" : "I miei task"}
          </Link>
          <div className="mt-3 mb-1 flex flex-wrap items-center gap-2">
            {task.clients && (
              <span className="text-xs font-medium uppercase tracking-wide text-brand">{task.clients.name}</span>
            )}
            <PriorityBadge priority={task.priority} />
            {task.archived && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">Archiviato</span>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold leading-tight">{task.title}</h1>
            {isAdmin && (
              <Link href={`/admin/task/${task.id}`} className="btn-ghost">Modifica</Link>
            )}
          </div>
          <DueDate date={task.due_date} done={pct === 100} />
        </div>

        {task.description && (
          <section className="card p-5">
            <p className="whitespace-pre-wrap text-sm text-stone-800">{task.description}</p>
          </section>
        )}

        {task.links?.length > 0 && (
          <section>
            <h2 className="label mb-2">Link allegati</h2>
            <LinkList links={task.links} />
          </section>
        )}

        {mine && (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Il tuo avanzamento</h2>
              <span className="text-2xl font-semibold tabular-nums">{mine.progress}%</span>
            </div>
            <ProgressEditor taskId={task.id} initialProgress={mine.progress} initialNote={mine.note} />
          </section>
        )}

        <section id="commenti" className="scroll-mt-24 space-y-4">
          <h2 className="font-semibold">
            Commenti <span className="text-muted">({comments.length})</span>
          </h2>

          {comments.length === 0 && (
            <p className="text-sm text-muted">Ancora nessun commento. Scrivi @ per chiedere qualcosa a un collaboratore.</p>
          )}

          <ul className="space-y-3">
            {comments.map((c) => {
              const canDelete = isAdmin || c.author_id === me.id;
              return (
                <li key={c.id} id={`c-${c.id}`} className="card scroll-mt-24 p-4 target:ring-2 target:ring-brand/40">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
                      {displayName(c.profiles).charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">
                      {c.author_id === me.id ? "Tu" : displayName(c.profiles)}
                    </span>
                    <span className="text-xs text-muted">{formatDateTime(c.created_at)}</span>
                    {canDelete && (
                      <form action={deleteComment} className="ml-auto">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="task_id" value={task.id} />
                        <ConfirmButton message="Eliminare questo commento?" className="text-xs text-muted hover:text-red-700">
                          Elimina
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                  <CommentBody body={c.body} meId={me.id} />
                </li>
              );
            })}
          </ul>

          <div className="card p-4">
            <CommentBox taskId={task.id} people={mentionable} />
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card p-5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label mb-0">Avanzamento totale</span>
            <span className="text-xl font-semibold tabular-nums">{pct}%</span>
          </div>
          <ProgressBar value={pct} />

          <ul className="mt-4 space-y-3">
            {task.task_assignees.map((a) => (
              <li key={a.user_id} className="text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{a.user_id === me.id ? "Tu" : displayName(a.profiles)}</span>
                  <span className="tabular-nums text-muted">{a.progress}%</span>
                </div>
                <ProgressBar value={a.progress} size="sm" />
                {a.note && <p className="mt-1 text-xs text-stone-600">💬 {a.note}</p>}
                {a.progress > 0 && (
                  <p className="mt-0.5 text-[11px] text-muted">Aggiornato {formatDateTime(a.updated_at)}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
        {!mine && !isAdmin && (
          <p className="rounded-lg bg-stone-100 px-4 py-3 text-xs text-muted">
            Vedi questo task perché sei stato menzionato in un commento. Puoi rispondere, ma non sei tra gli assegnatari.
          </p>
        )}
      </aside>
    </div>
  );
}
