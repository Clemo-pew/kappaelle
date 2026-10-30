import type { ReactNode } from "react";
import { MENTION_RE } from "@/lib/types";

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function linkify(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a
        key={`${keyBase}-u${i++}`}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-brand underline"
      >
        {m[0]}
      </a>,
    );
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Mostra il testo di un commento con menzioni evidenziate e link cliccabili. */
export function CommentBody({ body, meId }: { body: string; meId: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(...linkify(body.slice(last, start), `t${i}`));
    const isMe = m[2] === meId;
    parts.push(
      <span
        key={`m${i}`}
        className={`rounded px-1 font-medium ${isMe ? "bg-amber-100 text-amber-900" : "bg-brand/10 text-brand"}`}
      >
        @{m[1]}
      </span>,
    );
    last = start + m[0].length;
    i++;
  }
  if (last < body.length) parts.push(...linkify(body.slice(last), "end"));
  return <p className="whitespace-pre-wrap break-words text-sm text-stone-800">{parts}</p>;
}
