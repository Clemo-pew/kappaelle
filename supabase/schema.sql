-- =====================================================================
-- Gestionale Task — schema Supabase
-- Eseguire tutto in: Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Tipi ----------
do $$ begin
  create type public.user_role as enum ('admin', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('bassa', 'media', 'alta', 'urgente');
exception when duplicate_object then null; end $$;

-- ---------- Profili (1:1 con auth.users) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        public.user_role not null default 'employee',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Crea automaticamente il profilo quando nasce un utente auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Il ruolo NON viene mai letto dai metadati (manipolabili dal client):
  -- ogni nuovo utente nasce 'employee', la promozione ad admin avviene solo lato server.
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    'employee'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recupera i profili degli utenti creati PRIMA di eseguire questo script
insert into public.profiles (id, full_name, email, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', ''), coalesce(u.email, ''), 'employee'
from auth.users u
on conflict (id) do nothing;

-- Helper: l'utente corrente è admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- ---------- Clienti / progetti ----------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------- Task ----------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  client_id    uuid references public.clients(id) on delete set null,
  priority     public.task_priority not null default 'media',
  due_date     date,
  created_by   uuid references public.profiles(id) on delete set null,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- Assegnazioni (un task → più collaboratori, ognuno con la sua %) ----------
create table if not exists public.task_assignees (
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  progress     smallint not null default 0 check (progress between 0 and 100),
  note         text not null default '',
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists task_assignees_user_idx on public.task_assignees(user_id);
create index if not exists tasks_client_idx on public.tasks(client_id);

-- Helper: l'utente corrente è assegnato a questo task? (security definer → niente ricorsione RLS)
create or replace function public.is_assigned(p_task_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = p_task_id and user_id = auth.uid()
  );
$$;

-- Aggiorna updated_at e completed_at automaticamente
create or replace function public.touch_assignee()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.progress = 100 and (old is null or old.progress < 100) then
    new.completed_at := now();
  elsif new.progress < 100 then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists task_assignees_touch on public.task_assignees;
create trigger task_assignees_touch
  before insert or update on public.task_assignees
  for each row execute function public.touch_assignee();

-- Il collaboratore può modificare SOLO progress e note della propria riga
create or replace function public.guard_assignee_update()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if new.task_id <> old.task_id or new.user_id <> old.user_id then
      raise exception 'Non puoi modificare l''assegnazione';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists task_assignees_guard on public.task_assignees;
create trigger task_assignees_guard
  before update on public.task_assignees
  for each row execute function public.guard_assignee_update();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.clients        enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_assignees enable row level security;

-- profiles: ognuno vede sé stesso e i colleghi (servono i nomi); solo admin modifica
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- clients: lettura per tutti i loggati, scrittura solo admin
drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients
  for select to authenticated using (true);

drop policy if exists "clients_admin_write" on public.clients;
create policy "clients_admin_write" on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tasks: admin vede tutto; il collaboratore solo i task a cui è assegnato
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select to authenticated using (
    public.is_admin() or public.is_assigned(id)
  );

drop policy if exists "tasks_admin_write" on public.tasks;
create policy "tasks_admin_write" on public.tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- task_assignees: admin tutto; il collaboratore vede le righe dei propri task
-- (anche quelle dei colleghi sullo stesso task) e aggiorna solo la propria
drop policy if exists "assignees_select" on public.task_assignees;
create policy "assignees_select" on public.task_assignees
  for select to authenticated using (
    public.is_admin() or user_id = auth.uid() or public.is_assigned(task_id)
  );

drop policy if exists "assignees_self_update" on public.task_assignees;
create policy "assignees_self_update" on public.task_assignees
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "assignees_admin_insert" on public.task_assignees;
create policy "assignees_admin_insert" on public.task_assignees
  for insert to authenticated with check (public.is_admin());

drop policy if exists "assignees_admin_delete" on public.task_assignees;
create policy "assignees_admin_delete" on public.task_assignees
  for delete to authenticated using (public.is_admin());
