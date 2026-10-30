"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bulkTasks } from "./actions";

/** Avvolge la lista task: gestisce le caselle di selezione e la barra azioni in basso. */
export function BulkForm({ children, archivedView, total }: { children: React.ReactNode; archivedView: boolean; total: number }) {
  const ref = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);

  const boxes = () => Array.from(ref.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? []);
  const recount = useCallback(() => setCount(boxes().filter((b) => b.checked).length), []);

  // dopo un'azione la lista cambia: riallineo il conteggio
  useEffect(() => {
    recount();
  }, [children, recount]);

  function toggleAll(on: boolean) {
    boxes().forEach((b) => (b.checked = on));
    recount();
  }

  function confirmOp(e: React.MouseEvent<HTMLButtonElement>) {
    const op = e.currentTarget.value;
    const label = count === 1 ? "questo task" : `questi ${count} task`;
    const msg =
      op === "delete"
        ? `Eliminare definitivamente ${label}? Verranno cancellati anche commenti e avanzamenti.`
        : op === "archive"
          ? `Archiviare ${label}? Spariranno dalla vista dei collaboratori.`
          : `Ripristinare ${label}?`;
    if (!confirm(msg)) e.preventDefault();
  }

  return (
    <form
      ref={ref}
      action={bulkTasks}
      onChange={recount}
      onReset={() => setTimeout(recount)}
      className="space-y-3"
    >
      {total > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 px-1 text-sm text-muted">
          <input
            type="checkbox"
            checked={count > 0 && count === total}
            ref={(el) => {
              if (el) el.indeterminate = count > 0 && count < total;
            }}
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          Seleziona tutti ({total})
        </label>
      )}

      {children}

      {count > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 shadow-lg">
          <span className="mr-2 text-sm font-medium">{count} selezionati</span>
          {archivedView ? (
            <button name="op" value="restore" onClick={confirmOp} className="btn-ghost py-1.5">Ripristina</button>
          ) : (
            <button name="op" value="archive" onClick={confirmOp} className="btn-ghost py-1.5">Archivia</button>
          )}
          <button name="op" value="delete" onClick={confirmOp} className="btn-danger py-1.5">Elimina</button>
          <button type="button" onClick={() => toggleAll(false)} className="px-2 text-sm text-muted hover:text-ink">
            Annulla
          </button>
        </div>
      )}
    </form>
  );
}
