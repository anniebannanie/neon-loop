-- Neon Loop: Supabase setup
-- Run this once in your Supabase project: SQL Editor > New query > paste > Run.
-- It creates the tables, the private storage bucket for content, and the
-- permission rules. It is safe to read top to bottom; nothing here deletes data.

-- 1. People --------------------------------------------------------------
-- One row per signed-in user. first_name feeds the "Welcome, Annie" greeting.
-- role: producer (everything), team (upload to their events), client (their event only).
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  first_name  text not null default '',
  role        text not null default 'team' check (role in ('producer', 'team', 'client')),
  created_at  timestamptz not null default now()
);

-- 2. Events --------------------------------------------------------------
-- rules is null until the content rules are set; uploads are refused until then.
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           text not null default 'Other',
  event_date     date,
  rules          jsonb,
  rundown        jsonb not null default '[]'::jsonb,
  holding_asset  uuid,
  fade_ms        integer not null default 400,
  created_by     uuid not null default auth.uid() references auth.users,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3. Who can see which event --------------------------------------------
create table public.event_members (
  event_id  uuid not null references public.events on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'team' check (role in ('producer', 'team', 'client')),
  primary key (event_id, user_id)
);

-- 4. Content -------------------------------------------------------------
-- Files live in the "content" storage bucket at <event id>/<asset id>.<ext>.
-- Web pages (the pledge dashboard) have a url and no file.
-- Audio is music played under the pictures; fade_s is its fade in and out, in seconds.
-- design holds the layers of a graphic made in the Content Designer, so it can be reopened.
create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events on delete cascade,
  name          text not null,
  kind          text not null check (kind in ('image', 'video', 'web', 'audio')),
  url           text,
  storage_path  text,
  mime          text,
  bytes         bigint,
  width         integer,
  height        integer,
  loop          boolean not null default true,
  sound         boolean not null default false,
  fade_s        real not null default 2,
  design        jsonb,
  created_by    uuid not null default auth.uid() references auth.users,
  created_at    timestamptz not null default now()
);
create index assets_event_idx on public.assets (event_id);

-- 5. Permission helpers --------------------------------------------------
create function public.is_producer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'producer');
$$;

create function public.is_member(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_producer()
      or exists (select 1 from event_members where event_id = ev and user_id = auth.uid());
$$;

create function public.event_accepts_uploads(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = ev and rules is not null);
$$;

-- 6. New sign-ups get a profile -----------------------------------------
-- The very first account created becomes the producer. Everyone after is "team"
-- until a producer changes their role.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, first_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    case when not exists (select 1 from profiles) then 'producer' else 'team' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Row level security --------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.event_members enable row level security;
alter table public.assets        enable row level security;

-- profiles: you can read your own; producers read and change everyone's.
create policy "read own profile or all as producer" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_producer());
create policy "producers update profiles" on public.profiles
  for update to authenticated using (public.is_producer()) with check (public.is_producer());

-- events: members can see their events; only producers create, change or delete.
create policy "members read events" on public.events
  for select to authenticated using (public.is_member(id));
create policy "producers create events" on public.events
  for insert to authenticated with check (public.is_producer());
create policy "producers update events" on public.events
  for update to authenticated using (public.is_producer()) with check (public.is_producer());
create policy "producers delete events" on public.events
  for delete to authenticated using (public.is_producer());

-- event_members: you can see your own memberships; producers manage them.
create policy "read own memberships or all as producer" on public.event_members
  for select to authenticated using (user_id = auth.uid() or public.is_producer());
create policy "producers add members" on public.event_members
  for insert to authenticated with check (public.is_producer());
create policy "producers change members" on public.event_members
  for update to authenticated using (public.is_producer()) with check (public.is_producer());
create policy "producers remove members" on public.event_members
  for delete to authenticated using (public.is_producer());

-- assets: members see and add content for their events, once rules are set.
-- Members can rename; only producers delete.
create policy "members read assets" on public.assets
  for select to authenticated using (public.is_member(event_id));
create policy "members add assets when rules are set" on public.assets
  for insert to authenticated
  with check (public.is_member(event_id) and public.event_accepts_uploads(event_id) and created_by = auth.uid());
create policy "members update assets" on public.assets
  for update to authenticated using (public.is_member(event_id)) with check (public.is_member(event_id));
create policy "producers delete assets" on public.assets
  for delete to authenticated using (public.is_producer());

-- 8. Storage: a private bucket, one folder per event ----------------------
insert into storage.buckets (id, name, public)
values ('content', 'content', false)
on conflict (id) do nothing;

create policy "members read content files" on storage.objects
  for select to authenticated
  using (bucket_id = 'content' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "members upload content files when rules are set" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and public.event_accepts_uploads(((storage.foldername(name))[1])::uuid)
  );

create policy "producers delete content files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'content' and public.is_producer());

-- 9. Remote mode: one private live channel per event ---------------------
-- The show laptop and its remotes (a Surface, tablet or phone) talk over a
-- Realtime channel named nl:<event id>. Messages pass through and are not
-- stored. Only people who can see the event can listen or send on it.
create policy "members listen on their event's live channel" on realtime.messages
  for select to authenticated
  using (realtime.topic() like 'nl:%' and public.is_member((split_part(realtime.topic(), ':', 2))::uuid));

create policy "members send on their event's live channel" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() like 'nl:%' and public.is_member((split_part(realtime.topic(), ':', 2))::uuid));
