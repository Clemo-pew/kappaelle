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
  clients: Client | null;
  task_assignees: Assignee[];
};

export const PRIORITIES: Priority[] = ["bassa", "media", "alta", "urgente"];

export const TASK_SELECT =
  "id, title, description, client_id, priority, due_date, archived, created_at, clients(id, name), task_assignees(task_id, user_id, progress, note, completed_at, updated_at, profiles(id, full_name, email))";

export function taskProgress(t: Pick<Task, "task_assignees">) {
  if (!t.task_assignees.length) return 0;
  const sum = t.task_assignees.reduce((s, a) => s + a.progress, 0);
  return Math.round(sum / t.task_assignees.length);
}
