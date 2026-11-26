-- =============================================================
-- Razar Skating Skills - adatbazis
--
-- Ez a szkript MAR LE VAN FUTTATVA a hasznalt Supabase projektben.
-- Csak akkor kell ujra lefuttatni, ha egy uj, ures adatbazisba
-- koltoztetitek az appot (SQL Editor -> New query -> beilleszt -> Run).
--
-- A tablak neve "razar_" elotaggal kezdodik, hogy ugyanabban az
-- adatbazisban ellehessen a focis app is, osszeakadas nelkul.
-- =============================================================

create extension if not exists pgcrypto;

-- --- Tablak ---------------------------------------------------

create table if not exists razar_kids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_name text not null default 'U8-10',
  parent_name text,
  parent_phone text,
  parent_email text,
  pass_sessions_left integer not null default 0,
  is_active boolean not null default true,
  note text,
  billing_name text,                             -- szamlazasi nev
  billing_address text,                          -- szamlazasi cim
  sort_order integer not null default 0,
  deleted_at timestamptz,                        -- lomtar
  created_at timestamptz default now()
);

create table if not exists razar_lessons (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time text not null default '16:00',
  end_time text not null default '16:50',
  location text not null default 'Óbudai Jégpálya',
  locker_room text,                              -- 3 vagy 4
  group_name text not null default 'U8-10',
  status text not null default 'open',           -- open | cancelled
  note text,
  deleted_at timestamptz,                        -- lomtar
  created_at timestamptz default now()
);

create table if not exists razar_attendance (
  lesson_id uuid not null references razar_lessons(id) on delete cascade,
  kid_id uuid not null references razar_kids(id) on delete cascade,
  status text not null,                          -- yes | no
  updated_at timestamptz default now(),
  primary key (lesson_id, kid_id)
);

create table if not exists razar_payments (
  lesson_id uuid not null references razar_lessons(id) on delete cascade,
  kid_id uuid not null references razar_kids(id) on delete cascade,
  amount integer not null default 0,
  method text,                                   -- cash | transfer | pass
  paid boolean not null default false,
  used_pass boolean not null default false,
  paid_at timestamptz,
  pass_id uuid,                                  -- melyik berletbol ment le az alkalom
  note text,
  primary key (lesson_id, kid_id)
);

-- Berletek. Egy berlet onallo egyseg: sajat vasarlasi datummal, lejarattal
-- es arral. Tobb gyerek is hasznalhatja (testverek kozos berlete).
create table if not exists razar_passes (
  id uuid primary key default gen_random_uuid(),
  label text,
  total_sessions integer not null,
  price integer not null default 0,
  purchased_on date not null default current_date,
  expires_on date not null,
  paid boolean not null default false,
  paid_method text,                              -- cash | transfer
  paid_at timestamptz,
  note text,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ki hasznalhatja az adott berletet
create table if not exists razar_pass_kids (
  pass_id uuid not null references razar_passes(id) on delete cascade,
  kid_id  uuid not null references razar_kids(id)   on delete cascade,
  primary key (pass_id, kid_id)
);

create table if not exists razar_settings (
  key text primary key,
  value jsonb
);

-- Naplo: minden valtozas nyoma, hogy vissza lehessen keresni
create table if not exists razar_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text,
  action text not null,
  entity text,
  entity_id uuid,
  label text,
  details jsonb
);
create index if not exists razar_log_at_idx on razar_log (at desc);

-- --- Publikus nezet a gyerekekrol -----------------------------
-- A szulok csak a nevet es a csoportot latjak: a szulo elerhetosege,
-- a berlet allasa es a megjegyzes nem kerul ki ide.

create or replace view razar_kids_public as
  select id, name, group_name, is_active, sort_order
  from razar_kids
  where deleted_at is null;

alter view razar_kids_public set (security_invoker = off);
grant select on razar_kids_public to anon, authenticated;

-- --- Row Level Security ---------------------------------------

alter table razar_kids       enable row level security;
alter table razar_lessons    enable row level security;
alter table razar_attendance enable row level security;
alter table razar_payments   enable row level security;
alter table razar_settings   enable row level security;
alter table razar_log        enable row level security;
alter table razar_passes     enable row level security;
alter table razar_pass_kids  enable row level security;

-- berletek: penzugyi adat, csak bejelentkezve
create policy razar_passes_coach_all on razar_passes
  for all to authenticated using (true) with check (true);
create policy razar_pass_kids_coach_all on razar_pass_kids
  for all to authenticated using (true) with check (true);

-- gyerekek teljes adata: csak bejelentkezett edzonek
create policy razar_kids_coach_all on razar_kids
  for all to authenticated using (true) with check (true);

-- alkalmak: barki olvashatja, csak az edzo irhatja
create policy razar_lessons_public_read on razar_lessons
  for select to anon, authenticated using (true);
create policy razar_lessons_coach_all on razar_lessons
  for all to authenticated using (true) with check (true);

-- jelentkezes: barki olvashatja es irhatja (ez a szuloi funkcio)
create policy razar_att_public_read on razar_attendance
  for select to anon, authenticated using (true);
create policy razar_att_public_ins on razar_attendance
  for insert to anon, authenticated with check (true);
create policy razar_att_public_upd on razar_attendance
  for update to anon, authenticated using (true) with check (true);
create policy razar_att_public_del on razar_attendance
  for delete to anon, authenticated using (true);

-- fizetesek: KIZAROLAG bejelentkezett edzonek.
-- Nincs anon policy, ezert a szulo bongeszojebol ez a tabla nem olvashato.
create policy razar_payments_coach_all on razar_payments
  for all to authenticated using (true) with check (true);

-- beallitasok (arak, info szovegek): barki olvashatja, edzo irhatja
create policy razar_settings_public_read on razar_settings
  for select to anon, authenticated using (true);
create policy razar_settings_coach_all on razar_settings
  for all to authenticated using (true) with check (true);

-- A szulo megadhatja a gyereke szamlazasi adatait, de semmit nem tud
-- visszaolvasni. Eloszor elvesszuk tole a tabla osszes jogat, majd
-- visszaadunk pontosan annyit, amennyi a mentes muvelethez kell:
--   * olvasni: csak az azonositot (enelkul az UPDATE nem talalna meg a sort)
--   * irni: csak a ket szamlazasi mezot
revoke select, insert, update, delete, truncate on razar_kids from anon;
grant select (id) on razar_kids to anon;
grant update (parent_name, parent_phone, parent_email, billing_name, billing_address)
  on razar_kids to anon;

create policy razar_kids_parent_select_id on razar_kids
  for select to anon
  using (deleted_at is null);

create policy razar_kids_parent_billing on razar_kids
  for update to anon
  using (deleted_at is null)
  with check (deleted_at is null);

-- Uj csaladok jelentkezese. A szulo kitolti, de nem kerul be egybol a
-- nevsorba: az edzo hagyja jova a Gyerekek fulon.
create table if not exists razar_signups (
  id uuid primary key default gen_random_uuid(),
  kid_name text not null,
  group_name text not null default 'U8-10',
  parent_name text,
  parent_phone text,
  parent_email text,
  billing_name text,
  billing_address text,
  note text,
  handled_at timestamptz,
  handled_how text,                              -- felvetve | elvetve
  created_at timestamptz default now()
);

alter table razar_signups enable row level security;

revoke select, update, delete, truncate on razar_signups from anon;
grant insert on razar_signups to anon;

create policy razar_signups_anon_insert on razar_signups
  for insert to anon with check (true);
create policy razar_signups_coach_all on razar_signups
  for all to authenticated using (true) with check (true);

-- naplo: barki irhat bele (a szuloi jelentkezes is naplozodik),
-- de csak a bejelentkezett edzo olvashatja
create policy razar_log_anyone_insert on razar_log
  for insert to anon, authenticated with check (true);
create policy razar_log_coach_read on razar_log
  for select to authenticated using (true);
create policy razar_log_coach_delete on razar_log
  for delete to authenticated using (true);

-- --- Alapbeallitasok ------------------------------------------

insert into razar_settings (key, value) values
  ('pricing', '{"min_headcount":5,"tiers":[{"min":7,"drop_in":6000,"pass_extra":0},{"min":6,"drop_in":7000,"pass_extra":1000},{"min":5,"drop_in":8000,"pass_extra":2000}]}'::jsonb),
  ('info', '{"location_title":"Helyszín","location":"Óbudai Jégpálya","map_url":"","schedule":"Minden kedden","coaches":"Anna\nZsolt","pass_info":"A bérlet részleteit hamarosan kitöltjük.","transfer_name":"Szalma-Baráth Anna","transfer_account":"11600006-00000002-08354301","extra":""}'::jsonb),
  ('groups', '["U8-10"]'::jsonb),
  ('pass_types', '[{"sessions":5,"price":25000,"weeks":6},{"sessions":10,"price":45000,"weeks":12}]'::jsonb)
on conflict (key) do nothing;

-- --- Edzoi belepes --------------------------------------------
-- A Supabase Dashboardon: Authentication -> Users -> Add user
--   e-mail: edzo@razarskating.hu
--   jelszo: a kozos edzoi jelszo
--   "Auto Confirm User" bepipalva
