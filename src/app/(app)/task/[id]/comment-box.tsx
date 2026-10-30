"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { addComment, type CommentState } from "./actions";

type Person = { id: string; name: string };

/** Converte "@Nome Cognome" (scelti dall'elenco) nel formato salvato @[Nome Cognome](id). */
function tokenize(text: string, mentions: Person[]) {
  let out = text;
  [...mentions]
    .sort((a, b) => b.name.length - a.name.length)
    .forEach((p) => {
      out = out.split(`@${p.name}`).join(`@[${p.name}](${p.id})`);
    });
  return out;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function CommentBox({ taskId, people }: { taskId: string; people: Person[] }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(addComment, {});
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<Person[]>([]);
  const [query, setQuery] = useState<{ q: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.ok) {
      setText("");
      setMentions([]);
      setQuery(null);
    }
  }, [state.nonce, state.ok]);

  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = norm(query.q);
    return people
      .filter((p) => !q || norm(p.name).split(/\s+/).some((w) => w.startsWith(q)) || norm(p.name).startsWith(q))
      .slice(0, 6);
  }, [query, people]);

  function detect(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\p{L}\p{M}'-]{0,30})$/u);
    if (m) {
      setQuery({ q: m[1], start: caret - m[1].length - 1 });
      setActive(0);
    } else {
      setQuery(null);
    }
  }

  function pick(p: Person) {
    const el = ref.current;
    if (!el || !query) return;
    const caret = el.selectionStart;
    const insert = `@${p.name} `;
    const next = text.slice(0, query.start) + insert + text.slice(caret);
    setText(next);
    setMentions((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]));
    setQuery(null);
    const pos = query.start + insert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[active]);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    // Ctrl/Cmd + Invio invia il commento
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  const stillMentioned = mentions.filter((p) => text.includes(`@${p.name}`));

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="body" value={tokenize(text, mentions)} />
      <div className="relative">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            detect(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => detect(text, e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          rows={3}
          maxLength={5000}
          placeholder="Scrivi un commento… usa @ per menzionare un collaboratore"
          className="input resize-y"
          aria-label="Nuovo commento"
        />
        {query && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-lg sm:right-auto sm:w-72"
          >
            {suggestions.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === active ? "bg-brand/10" : ""
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !text.trim()} className="btn-primary">
          {pending ? "Invio…" : "Commenta"}
        </button>
        {stillMentioned.length > 0 && (
          <span className="text-xs text-muted">
            Riceveranno una notifica: {stillMentioned.map((p) => p.name).join(", ")}
          </span>
        )}
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
