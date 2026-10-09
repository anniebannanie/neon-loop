-- Neon Loop: remote mode live channel (section 9 of the setup script).
-- Already ran section 9 by hand? Mark it applied: supabase migration repair --status applied 20261009000002

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
