"use client";

import { useActionState, useEffect, useRef } from "react";
import { addClient, type FormState } from "../actions";

export function AddClientForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addClient, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="flex-1">
        <label className="label" htmlFor="name">Nuovo cliente / progetto</label>
        <input id="name" name="name" required className="input" placeholder="Es. Pasticceria Rossi" />
      </div>
      <button disabled={pending} className="btn-primary">Aggiungi</button>
      {state.error && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
