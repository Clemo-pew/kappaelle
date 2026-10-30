import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TASK_SELECT, type Task } from "@/lib/types";
import { DueDate, PriorityBadge, ProgressBar, formatDateTime } from "@/components/ui";
import { ProgressEditor } from "./progress-editor";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, bassa: 3 } as const;

export default async function MyTasksPage() {
  const me = await requireUser();
  const supabase = await createClient();

  const { data: mine } = await supabase.from("task_assignees").select("task_id").eq("user_id", me.id);
  const ids = (mine ?? []).map((r) => r.task_id as string);

  let tasks: Task[] = [];
  if (ids.length) {
    const { data } = await supabase.from("tasks").select(TASK_SELECT).in("id", ids).eq("archived", false);
    tasks = (data ?? []) as unknown as Task[];
  }

  const myRow = (t: Task) => t.task_assignees.find((a) => a.user_id === me.id)!;

  const open = tasks
    .filter((t) => myRow(t).progress < 100)
    .sort((a, b) => {
      const da = a.due_date ?? "9999-12-31";
      const db = b.due_date ?? "9999-12-31";
      if (da !== db) return da < db ? -1 : 1;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

  const done = tasks
    .filter((t) => myRow(t).progress === 100)
    .sort((a, b) => (myRow(b).completed_at ?? "").localeCompare(myRow(a).completed_at ?? ""));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Ciao {me.full_name.split(" ")[0] || ""} 👋</h1>
        <p className="text-sm text-muted">
          {open.length === 0
            ? "Nessun task aperto. Ottimo lavoro!"
            : `Hai ${open.length} task da completare.`}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Da completare</h2>
        {open.map((t) => (
          <TaskCard key={t.id} task={t} meId={me.id} />
        ))}
        {open.length === 0 && <div className="card p-6 text-sm text-muted">Niente in sospeso.</div>}
      </section>

      {done.length > 0 && (
        <section className="space-y-4">
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-muted">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span> Completati ({done.length})
            </summary>
            <div className="mt-4 space-y-4">
              {done.map((t) => (
                <TaskCard key={t.id} task={t} meId={me.id} />
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

function TaskCard({ task, meId }: { task: Task; meId: string }) {
  const mine = task.task_assignees.find((a) => a.user_id === meId)!;
  const others = task.task_assignees.filter((a) => a.user_id !== meId);

  return (
    <article className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {task.clients && (
              <span className="text-xs font-medium uppercase tracking-wide text-brand">{task.clients.name}</span>
            )}
            <PriorityBadge priority={task.priority} />
          </div>
          <h3 className="text-lg font-semibold leading-snug">{task.title}</h3>
          <DueDate date={task.due_date} done={mine.progress === 100} />
        </div>
        <div className="w-32 text-right">
          <div className="text-2xl font-semibold tabular-nums">{mine.progress}%</div>
          <ProgressBar value={mine.progress} size="sm" />
        </div>
      </div>

      {task.description && (
        <p className="mb-4 whitespace-pre-wrap text-sm text-stone-700">{task.description}</p>
      )}

      {others.length > 0 && (
        <div className="mb-4 rounded-lg bg-stone-50 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Colleghi sul task</div>
          <ul className="space-y-1.5">
            {others.map((a) => (
              <li key={a.user_id} className="flex items-center gap-3 text-sm">
                <span className="w-36 truncate">{a.profiles?.full_name || a.profiles?.email}</span>
                <div className="flex-1">
                  <ProgressBar value={a.progress} size="sm" />
                </div>
                <span className="w-10 text-right tabular-nums text-muted">{a.progress}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProgressEditor taskId={task.id} initialProgress={mine.progress} initialNote={mine.note} />
      <p className="mt-2 text-xs text-muted">Ultimo aggiornamento: {formatDateTime(mine.updated_at)}</p>
    </article>
  );
}
