"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createEmployee, resetPassword, type FormState } from "../actions";

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function NewEmployeeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createEmployee, {});
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [lastPassword, setLastPassword] = useState("");

  useEffect(() => {
    if (state.ok) {
      setLastPassword(password);
      formRef.current?.reset();
      setPassword("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card space-y-4 p-5">
      <h2 className="font-semibold">Nuovo account</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="label" htmlFor="full_name">Nome e cognome</label>
          <input id="full_name" name="full_name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password iniziale</label>
          <div className="flex gap-2">
            <input
              id="password"
              name="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input font-mono"
            />
            <button type="button" onClick={() => setPassword(randomPassword())} className="btn-ghost px-3" title="Genera">
              ⟳
            </button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="role">Ruolo</label>
          <select id="role" name="role" defaultValue="employee" className="input">
            <option value="employee">Dipendente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Creazione…" : "Crea account"}</button>
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state.ok && (
          <span className="text-sm text-ok">
            {state.message} {lastPassword && <>Password: <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-ink">{lastPassword}</code></>}
          </span>
        )}
      </div>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
        Reimposta password
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="password" minLength={8} required placeholder="Nuova password" className="input w-40 font-mono" />
      <button disabled={pending} className="btn-primary">OK</button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">Chiudi</button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state.ok && <span className="text-xs text-ok">{state.message}</span>}
    </form>
  );
}
