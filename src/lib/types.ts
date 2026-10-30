export type Role = "admin" | "employee";
export type Priority = "bassa" | "media" | "alta" | "urgente";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type Client = { id: string; name: string };

export type Assignee = {
  task_id: string;
  user_id: string;
  progress: number;
  note: string;
  completed_at: string | null;
  updated_at: string;
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  client_id: string | null;
  priority: Priority;
  due_date: string | null;
  archived: boolean;
  created_at: string;
  links: TaskLink[];
  clients: Client | null;
  task_assignees: Assignee[];
  task_comments: { count: number }[];
};

export type TaskLink = { label: string; url: string };

export type Comment = {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type Notification = {
  id: string;
  type: "assigned" | "mention";
  task_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: Pick<Profile, "id" | "full_name" | "email"> | null;
  tasks: { id: string; title: string } | null;
};

export const PRIORITIES: Priority[] = ["bassa", "media", "alta", "urgente"];

export const TASK_SELECT =
  "id, title, description, client_id, priority, due_date, archived, created_at, links, clients(id, name), task_assignees(task_id, user_id, progress, note, completed_at, updated_at, profiles(id, full_name, email)), task_comments(count)";

export function commentCount(t: Pick<Task, "task_comments">) {
  return t.task_comments?.[0]?.count ?? 0;
}

/** Formato menzione salvato nel testo: @[Nome Cognome](uuid) */
export const MENTION_RE = /@\[([^\]\n]{1,80})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g;

export function displayName(p: { full_name?: string | null; email?: string | null } | null | undefined) {
  return p?.full_name || p?.email || "Utente rimosso";
}

export function taskProgress(t: Pick<Task, "task_assignees">) {
  if (!t.task_assignees.length) return 0;
  const sum = t.task_assignees.reduce((s, a) => s + a.progress, 0);
  return Math.round(sum / t.task_assignees.length);
}
