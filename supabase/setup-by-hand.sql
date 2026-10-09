-- =====================================================================
-- Neon Loop: complete Supabase setup, by hand
-- Supabase > SQL Editor > New query > paste all of this > Run.
--
-- Creates the tables, permissions, the private storage bucket for content,
-- the live channel rules for remote mode, guests and pledges, and a profile
-- for anyone who signed up before this ran (the first becomes the producer).
--
-- Safe to run again: it skips what already exists and never deletes data.
-- Using the Supabase CLI later? This covers all three migrations, so first run:
--   supabase migration repair --status applied 20261009000001 20261009000002 20261009000003
-- =====================================================================

-- 1. People ---------------------------------------------------------------
-- One row per signed-in user. first_name feeds the "Welcome, Annie" greeting.
-- role: producer (everything), team (their events), client (their event only, no guest details).
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  first_name  text not null default '',
  role        text not null default 'team' check (role in ('producer', 'team', 'client')),
  created_at  timestamptz not null default now()
);

-- 2. Events ---------------------------------------------------------------
-- rules is null until the content rules are set; uploads are refused until then.
create table if not exists public.events (
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
-- How the event is funded, takeover settings, and what remotes may do.
alter table public.events add column if not exists funding jsonb not null default '{"mode":"own","budget":0,"allowance":0,"company":"","allowOwn":false}'::jsonb;
alter table public.events add column if not exists remote  jsonb not null default '{"on":false,"show":true,"pledge":true}'::jsonb;

-- 3. Who can see which event ---------------------------------------------
create table if not exists public.event_members (
  event_id  uuid not null references public.events on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'team' check (role in ('producer', 'team', 'client')),
  primary key (event_id, user_id)
);

-- 4. Content --------------------------------------------------------------
-- Files live in the "content" bucket at <event id>/<asset id>.<ext>. Web pages have a url and no file.
create table if not exists public.assets (
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
create index if not exists assets_event_idx on public.assets (event_id);

-- 5. Organisations, guests and pledges -------------------------------------
create table if not exists public.orgs (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events on delete cascade,
  name         text not null,
  match        numeric(12,2) not null default 0 check (match >= 0),
  target       numeric(12,2) not null default 0 check (target >= 0),
  impact_amt   numeric(12,2),
  impact_unit  text,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists orgs_event_idx on public.orgs (event_id);

create table if not exists public.guests (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events on delete cascade,
  kind        text not null default 'guest' check (kind in ('guest', 'org')),
  first_name  text not null default '',
  last_name   text not null default '',
  company     text not null default '',
  email       text not null default '',
  phone       text not null default '',
  table_no    text not null default '',
  tag         text,                                  -- wristband or card ID
  new_donor   boolean not null default false,
  walk_in     boolean not null default false,
  arrived_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists guests_event_idx on public.guests (event_id);
create unique index if not exists guests_tag_unique on public.guests (event_id, lower(tag)) where tag is not null and tag <> '';

-- Pledges are never deleted: a removed pledge is voided, keeping an audit trail.
create table if not exists public.pledges (
  id           uuid primary key,                     -- made on the device, so a pledge sent twice is stored once
  event_id     uuid not null references public.events on delete cascade,
  org_id       uuid references public.orgs on delete set null,
  guest_id     uuid references public.guests on delete set null,
  donor_name   text not null default '',
  amount       numeric(12,2) not null check (amount > 0),
  anonymous    boolean not null default false,
  paid_from    text not null default 'own' check (paid_from in ('own', 'budget')),
  entered_via  text not null default '',             -- e.g. the remote's name
  entered_by   uuid default auth.uid() references auth.users,
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references auth.users,
  amended_from numeric(12,2)                         -- the original amount if it was corrected
);
create index if not exists pledges_event_idx on public.pledges (event_id, created_at);

-- 6. Permission helpers ---------------------------------------------------
create or replace function public.is_producer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'producer');
$$;

create or replace function public.is_member(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_producer()
      or exists (select 1 from event_members where event_id = ev and user_id = auth.uid());
$$;

-- Producers and team on the event: the people who may see guests' personal details.
create or replace function public.is_staff(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_producer()
      or exists (select 1 from event_members where event_id = ev and user_id = auth.uid() and role in ('producer', 'team'));
$$;

create or replace function public.event_accepts_uploads(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = ev and rules is not null);
$$;

-- 7. New sign-ups get a profile -----------------------------------------
-- The very first account becomes the producer; everyone after is "team".
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, first_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    case when not exists (select 1 from profiles) then 'producer' else 'team' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who signed up before this ran gets a profile now. If there is no
-- producer yet, the earliest account becomes the producer.
insert into public.profiles (id, first_name, role)
select u.id, coalesce(u.raw_user_meta_data ->> 'first_name', ''), 'team'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles set role = 'producer'
where id = (select p.id from public.profiles p join auth.users u on u.id = p.id order by u.created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'producer');

-- 8. Row level security --------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.event_members enable row level security;
alter table public.assets        enable row level security;
alter table public.orgs          enable row level security;
alter table public.guests        enable row level security;
alter table public.pledges       enable row level security;

-- profiles: read your own; producers read and change everyone's.
drop policy if exists "read own profile or all as producer" on public.profiles;
create policy "read own profile or all as producer" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_producer());
drop policy if exists "producers update profiles" on public.profiles;
create policy "producers update profiles" on public.profiles
  for update to authenticated using (public.is_producer()) with check (public.is_producer());

-- events: members see their events; only producers create, change or delete.
drop policy if exists "members read events" on public.events;
create policy "members read events" on public.events
  for select to authenticated using (public.is_member(id));
drop policy if exists "producers create events" on public.events;
create policy "producers create events" on public.events
  for insert to authenticated with check (public.is_producer());
drop policy if exists "producers update events" on public.events;
create policy "producers update events" on public.events
  for update to authenticated using (public.is_producer()) with check (public.is_producer());
drop policy if exists "producers delete events" on public.events;
create policy "producers delete events" on public.events
  for delete to authenticated using (public.is_producer());

-- event_members: see your own memberships; producers manage them.
drop policy if exists "read own memberships or all as producer" on public.event_members;
create policy "read own memberships or all as producer" on public.event_members
  for select to authenticated using (user_id = auth.uid() or public.is_producer());
drop policy if exists "producers add members" on public.event_members;
create policy "producers add members" on public.event_members
  for insert to authenticated with check (public.is_producer());
drop policy if exists "producers change members" on public.event_members;
create policy "producers change members" on public.event_members
  for update to authenticated using (public.is_producer()) with check (public.is_producer());
drop policy if exists "producers remove members" on public.event_members;
create policy "producers remove members" on public.event_members
  for delete to authenticated using (public.is_producer());

-- assets: members see and add content once rules are set; members rename; producers delete.
drop policy if exists "members read assets" on public.assets;
create policy "members read assets" on public.assets
  for select to authenticated using (public.is_member(event_id));
drop policy if exists "members add assets when rules are set" on public.assets;
create policy "members add assets when rules are set" on public.assets
  for insert to authenticated
  with check (public.is_member(event_id) and public.event_accepts_uploads(event_id) and created_by = auth.uid());
drop policy if exists "members update assets" on public.assets;
create policy "members update assets" on public.assets
  for update to authenticated using (public.is_member(event_id)) with check (public.is_member(event_id));
drop policy if exists "producers delete assets" on public.assets;
create policy "producers delete assets" on public.assets
  for delete to authenticated using (public.is_producer());

-- organisations: anyone on the event sees them (the tally shows them); producers set them up.
drop policy if exists "members read orgs" on public.orgs;
create policy "members read orgs" on public.orgs for select to authenticated using (public.is_member(event_id));
drop policy if exists "producers manage orgs" on public.orgs;
create policy "producers manage orgs" on public.orgs for all to authenticated using (public.is_producer()) with check (public.is_producer());

-- guests: personal data, so staff only.
drop policy if exists "staff read guests" on public.guests;
create policy "staff read guests" on public.guests for select to authenticated using (public.is_staff(event_id));
drop policy if exists "staff add guests" on public.guests;
create policy "staff add guests" on public.guests for insert to authenticated with check (public.is_staff(event_id));
drop policy if exists "staff update guests" on public.guests;
create policy "staff update guests" on public.guests for update to authenticated using (public.is_staff(event_id)) with check (public.is_staff(event_id));
drop policy if exists "producers remove guests" on public.guests;
create policy "producers remove guests" on public.guests for delete to authenticated using (public.is_producer());

-- pledges: staff record and correct them; nobody deletes them (void instead).
drop policy if exists "staff read pledges" on public.pledges;
create policy "staff read pledges" on public.pledges for select to authenticated using (public.is_staff(event_id));
drop policy if exists "staff record pledges" on public.pledges;
create policy "staff record pledges" on public.pledges for insert to authenticated with check (public.is_staff(event_id) and entered_by = auth.uid());
drop policy if exists "staff correct pledges" on public.pledges;
create policy "staff correct pledges" on public.pledges for update to authenticated using (public.is_staff(event_id)) with check (public.is_staff(event_id));

-- 9. Storage: a private bucket, one folder per event ----------------------
insert into storage.buckets (id, name, public)
values ('content', 'content', false)
on conflict (id) do nothing;

drop policy if exists "members read content files" on storage.objects;
create policy "members read content files" on storage.objects
  for select to authenticated
  using (bucket_id = 'content' and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "members upload content files when rules are set" on storage.objects;
create policy "members upload content files when rules are set" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and public.event_accepts_uploads(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "producers delete content files" on storage.objects;
create policy "producers delete content files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'content' and public.is_producer());

-- 10. Remote mode: one private live channel per event ---------------------
-- The show laptop and its remotes talk over a Realtime channel named nl:<event id>.
-- Messages pass through and are not stored. Only people on the event can use it.
drop policy if exists "members listen on their event's live channel" on realtime.messages;
create policy "members listen on their event's live channel" on realtime.messages
  for select to authenticated
  using (realtime.topic() like 'nl:%' and public.is_member((split_part(realtime.topic(), ':', 2))::uuid));

drop policy if exists "members send on their event's live channel" on realtime.messages;
create policy "members send on their event's live channel" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() like 'nl:%' and public.is_member((split_part(realtime.topic(), ':', 2))::uuid));

-- Remotes and dashboards can follow pledges, guests and organisations live.
do $$
declare t text;
begin
  foreach t in array array['pledges', 'guests', 'orgs'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Make the API see the new tables straight away.
notify pgrst, 'reload schema';
