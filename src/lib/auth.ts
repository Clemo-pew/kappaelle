import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

type Lookup =
  | { status: "anon" }
  | { status: "no-profile"; reason: string }
  | { status: "ok"; profile: Profile };

async function lookup(): Promise<Lookup> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anon" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] lettura profilo fallita:", error.message);
    return { status: "no-profile", reason: "schema" };
  }
  if (!data) return { status: "no-profile", reason: "profilo" };
  return { status: "ok", profile: data as Profile };
}

export async function getProfile(): Promise<Profile | null> {
  const r = await lookup();
  return r.status === "ok" ? r.profile : null;
}

export async function requireUser(): Promise<Profile> {
  const r = await lookup();
  if (r.status === "anon") redirect("/login");
  if (r.status === "no-profile") redirect(`/login?errore=${r.reason}`);
  if (!r.profile.active) redirect("/login?errore=disattivato");
  return r.profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/miei-task");
  return profile;
}
