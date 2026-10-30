"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { updateMyProgress, type ProgressState } from "./actions";

const QUICK = [25, 50, 75, 90];

export function ProgressEditor({
  taskId,
  initialProgress,
  initialNote,
}: {
  taskId: string;
  initialProgress: number;
  initialNote: string;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [note, setNote] = useState(initialNote);
  const [state, action, pending] = useActionState<ProgressState, FormData>(updateMyProgress, {});
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const dirty = progress !== initialProgress || note !== initialNote;
  const done = progress === 100;

  function markComplete() {
    setProgress(100);
    // invia subito con 100%
    const fd = new FormData(formRef.current!);
    fd.set("progress", "100");
    startTransition(() => action(fd));
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="progress" value={progress} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={markComplete}
          disabled={pending}
          className={`btn ${done ? "bg-ok text-white" : "border border-ok/30 bg-white text-ok hover:bg-green-50"}`}
        >
          ✓ {done ? "Completato" : "Segna completato (100%)"}
        </button>
        <span className="text-xs text-muted">oppure quasi finito:</span>
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setProgress(q)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              progress === q ? "border-brand bg-brand text-white" : "border-line bg-white hover:bg-stone-100"
            }`}
          >
            {q}%
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="flex-1 accent-[var(--color-brand)]"
          aria-label="Percentuale di completamento"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            className="input w-20 text-right"
            aria-label="Percentuale"
          />
          <span className="text-sm text-muted">%</span>
        </div>
      </div>

      <textarea
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Nota per l'admin (facoltativa): cosa manca, blocchi, link…"
        className="input resize-y"
      />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !dirty} className="btn-primary">
          {pending ? "Salvataggio…" : "Salva avanzamento"}
        </button>
        {saved && <span className="text-sm text-ok">Salvato ✓</span>}
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
