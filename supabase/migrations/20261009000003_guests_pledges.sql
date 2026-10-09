-- Neon Loop: guests, organisations and pledges move into the database, so several
-- devices share one list and a lost laptop loses nothing. Pledges are never deleted:
-- a removed pledge is voided, which keeps an audit trail for reconciliation.

-- Who may see personal details: producers, and team members on the event. Clients may not.
create function public.is_staff(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_producer()
      or exists (select 1 from event_members where event_id = ev and user_id = auth.uid() and role in ('producer', 'team'));
$$;

-- How the event is funded, takeover settings and remote permissions (were kept on the laptop).
alter table public.events
  add column funding jsonb not null default '{"mode":"own","budget":0,"allowance":0,"company":"","allowOwn":false}'::jsonb,
  add column remote  jsonb not null default '{"on":false,"show":true,"pledge":true}'::jsonb;

create table public.orgs (
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
create index orgs_event_idx on public.orgs (event_id);

create table public.guests (
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
create index guests_event_idx on public.guests (event_id);
create unique index guests_tag_unique on public.guests (event_id, lower(tag)) where tag is not null and tag <> '';

create table public.pledges (
  id          uuid primary key,                      -- made on the device, so a pledge sent twice is stored once
  event_id    uuid not null references public.events on delete cascade,
  org_id      uuid references public.orgs on delete set null,
  guest_id    uuid references public.guests on delete set null,
  donor_name  text not null default '',
  amount      numeric(12,2) not null check (amount > 0),
  anonymous   boolean not null default false,
  paid_from   text not null default 'own' check (paid_from in ('own', 'budget')),
  entered_via text not null default '',              -- e.g. the remote's name
  entered_by  uuid default auth.uid() references auth.users,
  created_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references auth.users,
  amended_from numeric(12,2)                         -- the original amount if it was corrected
);
create index pledges_event_idx on public.pledges (event_id, created_at);

alter table public.orgs    enable row level security;
alter table public.guests  enable row level security;
alter table public.pledges enable row level security;

-- organisations: anyone on the event can see them (the tally shows them); producers set them up.
create policy "members read orgs" on public.orgs for select to authenticated using (public.is_member(event_id));
create policy "producers manage orgs" on public.orgs for all to authenticated using (public.is_producer()) with check (public.is_producer());

-- guests: personal data, so staff only.
create policy "staff read guests" on public.guests for select to authenticated using (public.is_staff(event_id));
create policy "staff add guests" on public.guests for insert to authenticated with check (public.is_staff(event_id));
create policy "staff update guests" on public.guests for update to authenticated using (public.is_staff(event_id)) with check (public.is_staff(event_id));
create policy "producers remove guests" on public.guests for delete to authenticated using (public.is_producer());

-- pledges: staff record and correct them; nobody deletes them (void instead).
create policy "staff read pledges" on public.pledges for select to authenticated using (public.is_staff(event_id));
create policy "staff record pledges" on public.pledges for insert to authenticated with check (public.is_staff(event_id) and entered_by = auth.uid());
create policy "staff correct pledges" on public.pledges for update to authenticated using (public.is_staff(event_id)) with check (public.is_staff(event_id));

-- Remotes and dashboards can follow changes live.
alter publication supabase_realtime add table public.pledges, public.guests, public.orgs;
