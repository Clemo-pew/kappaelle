import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Client, Profile } from "@/lib/types";

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, name").order("name");
  return (data ?? []) as Client[];
}

export async function getEmployees(onlyActive = true): Promise<Profile[]> {
  const supabase = await createClient();
  let q = supabase.from("profiles").select("id, full_name, email, role, active").order("full_name");
  if (onlyActive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Profile[];
}
