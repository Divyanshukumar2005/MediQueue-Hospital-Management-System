-- ═══════════════════════════════════════════════════════════════════════════
--  MediQueue — Supabase schema  (PostgreSQL)
--  Run this ONCE in:  Supabase Dashboard → SQL Editor → New query → Run
--
--  What this replaces from the old Node/Express/MySQL backend:
--    • Sequelize models + sync()          → tables below
--    • JWT middleware / role checks       → Row Level Security (RLS) policies
--    • controllers (booking, tokens...)   → SQL functions (RPC) — atomic & race-safe
--    • polling every 10-30s               → Supabase Realtime (queue_state signal table)
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 0. Helpers
-- ───────────────────────────────────────────────────────────────────────────
-- The hospital runs on Indian Standard Time. Every "today" / "noon cut-off"
-- below is computed in IST on the database, so it can never disagree with the
-- browser's or the server's timezone (the old backend mixed UTC and IST).
create or replace function public.hospital_today()
returns date language sql stable as
$$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.hospital_hour()
returns int language sql stable as
$$ select extract(hour from (now() at time zone 'Asia/Kolkata'))::int $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ───────────────────────────────────────────────────────────────────────────

-- One row per auth.users row (created automatically by a trigger, see §3).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  email         text not null unique,
  phone         text,
  photo_url     text,
  role          text not null default 'patient'
                check (role in ('patient','doctor','admin','medicine_staff')),
  auth_provider text not null default 'local' check (auth_provider in ('local','google')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Departments are data now (they were a hard-coded ENUM + 3 duplicated JS maps),
-- so the admin "Add Department" button really works.
create table if not exists public.departments (
  name                    text primary key,
  label                   text not null,
  icon                    text not null default '🏥',
  room_number             text,
  floor                   text default 'Ground',
  description             text,
  color                   text default '#0d6e6e',
  max_tokens_per_day      int  not null default 60  check (max_tokens_per_day > 0),
  avg_minutes_per_patient int  not null default 10  check (avg_minutes_per_patient > 0),
  sort_order              int  not null default 100
);

create table if not exists public.doctors (
  id              bigint generated always as identity primary key,
  user_id         uuid unique references public.profiles(id) on delete set null,  -- login account (nullable for demo doctors)
  name            text not null,
  department      text not null references public.departments(name) on update cascade,
  room_number     text,
  specialization  text,
  available_days  text default 'Mon,Tue,Wed,Thu,Fri',
  is_active       boolean not null default true,
  photo_url       text,
  created_at      timestamptz not null default now()
);

create table if not exists public.opd_cards (
  id           bigint generated always as identity primary key,
  user_id      uuid not null unique references public.profiles(id) on delete cascade,
  card_number  text not null unique,
  blood_group  text,
  age          int check (age between 0 and 130),
  gender       text check (gender in ('Male','Female','Other')),
  phone        text,
  address      text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.appointments (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  doctor_id   bigint references public.doctors(id) on delete set null,
  department  text not null references public.departments(name) on update cascade,
  appt_date   date not null,
  token_id    bigint,                                   -- FK added after tokens exists
  status      text not null default 'pending'
              check (status in ('pending','confirmed','visited','cancelled')),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists appointments_user_idx on public.appointments(user_id, appt_date desc);
create index if not exists appointments_slot_idx on public.appointments(department, appt_date);

create table if not exists public.tokens (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  doctor_id       bigint references public.doctors(id) on delete set null,
  token_number    int  not null,
  department      text not null references public.departments(name) on update cascade,
  room_number     text,
  status          text not null default 'waiting'
                  check (status in ('waiting','called','completed','cancelled')),
  estimated_time  int,                                  -- minutes
  tokens_ahead    int default 0,
  appt_date       date not null,
  token_uid       text unique,                          -- globally unique, this is what the QR encodes
  called_at       timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (department, appt_date, token_number)
);
create index if not exists tokens_user_idx  on public.tokens(user_id, created_at desc);
create index if not exists tokens_queue_idx on public.tokens(department, appt_date, status);

alter table public.appointments
  drop constraint if exists appointments_token_fk;
alter table public.appointments
  add constraint appointments_token_fk foreign key (token_id)
  references public.tokens(id) on delete set null;

create table if not exists public.opd_visits (
  id              bigint generated always as identity primary key,
  opd_id          bigint not null references public.opd_cards(id) on delete cascade,
  token_id        bigint references public.tokens(id) on delete set null,
  symptoms        text not null,
  diagnosis       text,
  prescription    text,
  doctor_name     text,
  follow_up_date  date,
  visit_date      date not null default public.hospital_today(),
  created_at      timestamptz not null default now()
);
create index if not exists opd_visits_card_idx on public.opd_visits(opd_id, visit_date desc);

create table if not exists public.medicines (
  id            bigint generated always as identity primary key,
  name          text not null,
  category      text,
  stock         int  not null default 0 check (stock >= 0),
  unit          text not null default 'tablet',
  -- derived automatically — the old app let this drift out of sync with stock
  is_available  boolean generated always as (stock > 0) stored,
  description   text,
  created_at    timestamptz not null default now()
);

create table if not exists public.medicine_requests (
  id                 bigint generated always as identity primary key,
  visit_id           bigint not null references public.opd_visits(id) on delete cascade,
  user_id            uuid   not null references public.profiles(id) on delete cascade,
  token_id           bigint references public.tokens(id) on delete set null,
  prescription_text  text not null,
  status             text not null default 'pending'
                     check (status in ('pending','preparing','ready','dispensed')),
  admin_notes        text,
  ready_at           timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists med_requests_user_idx on public.medicine_requests(user_id, created_at desc);

-- A tiny "something changed in this department's queue" signal table.
-- Clients subscribe to it with Supabase Realtime and re-fetch get_queue_status().
-- (We cannot broadcast the real `tokens` table to everyone because RLS rightly
--  hides other patients' tokens — this table carries no personal data.)
create table if not exists public.queue_state (
  department  text primary key,
  updated_at  timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Role helpers (used by RLS policies and RPCs)
-- ───────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can read `profiles` without recursing into its own RLS.
-- Returns NULL for deactivated users, so a deactivated account loses all powers.
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and is_active $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Triggers
-- ───────────────────────────────────────────────────────────────────────────

-- 3a. New auth user → profile row. The role is ALWAYS 'patient' here, whatever
--     metadata the client sends, so nobody can sign themselves up as admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  insert into public.profiles (id, name, email, phone, photo_url, auth_provider)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''),
             nullif(new.raw_user_meta_data->>'full_name',''),
             split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'phone',''),
    coalesce(nullif(new.raw_user_meta_data->>'avatar_url',''),
             nullif(new.raw_user_meta_data->>'picture','')),
    case when new.raw_app_meta_data->>'provider' = 'google' then 'google' else 'local' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3b. Users may edit their own name/phone/photo — but never role, status or email.
--     (auth.uid() is NULL inside the SQL editor / service role, which is how you
--      promote the very first admin; see the bottom of this file.)
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and public.my_role() is distinct from 'admin' then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'You are not allowed to change role, status or email.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- 3c. Any change to a token (or department setting) pings queue_state → Realtime.
create or replace function public.touch_queue_from_tokens()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  insert into public.queue_state(department, updated_at)
  values (case when tg_op = 'DELETE' then old.department else new.department end, now())
  on conflict (department) do update set updated_at = now();
  return null;
end $$;

create or replace function public.touch_queue_from_departments()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  insert into public.queue_state(department, updated_at) values (new.name, now())
  on conflict (department) do update set updated_at = now();
  return null;
end $$;

drop trigger if exists tokens_touch_queue on public.tokens;
create trigger tokens_touch_queue
  after insert or update or delete on public.tokens
  for each row execute function public.touch_queue_from_tokens();

drop trigger if exists departments_touch_queue on public.departments;
create trigger departments_touch_queue
  after insert or update on public.departments
  for each row execute function public.touch_queue_from_departments();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
--    The old Express API had NO auth on most routes (anyone could read every
--    patient's tokens/OPD data). Here the database itself enforces access.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.departments       enable row level security;
alter table public.doctors           enable row level security;
alter table public.opd_cards         enable row level security;
alter table public.appointments      enable row level security;
alter table public.tokens            enable row level security;
alter table public.opd_visits        enable row level security;
alter table public.medicines         enable row level security;
alter table public.medicine_requests enable row level security;
alter table public.queue_state       enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() in ('admin','doctor','medicine_staff'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.my_role() = 'admin')
  with check (id = auth.uid() or public.my_role() = 'admin');

-- departments: readable by everyone (public live-queue board), writable by admin
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments for select to anon, authenticated using (true);
drop policy if exists departments_admin on public.departments;
create policy departments_admin on public.departments for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- queue_state: public signal table (no personal data)
drop policy if exists queue_state_select on public.queue_state;
create policy queue_state_select on public.queue_state for select to anon, authenticated using (true);

-- doctors
drop policy if exists doctors_select on public.doctors;
create policy doctors_select on public.doctors for select to authenticated using (true);
drop policy if exists doctors_admin on public.doctors;
create policy doctors_admin on public.doctors for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- opd_cards: owner or doctor/admin can read; owner can edit ONLY demographic columns
drop policy if exists opd_cards_select on public.opd_cards;
create policy opd_cards_select on public.opd_cards for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('doctor','admin'));
drop policy if exists opd_cards_update on public.opd_cards;
create policy opd_cards_update on public.opd_cards for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.opd_cards from authenticated, anon;
grant  update (age, gender, blood_group, phone, address) on public.opd_cards to authenticated;

-- appointments / tokens: read-only from the client; all writes go through RPCs
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('doctor','admin'));
drop policy if exists tokens_select on public.tokens;
create policy tokens_select on public.tokens for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('doctor','admin'));

-- opd_visits: patient sees own, doctor/admin see all, pharmacy sees visits behind a prescription request
drop policy if exists opd_visits_select on public.opd_visits;
create policy opd_visits_select on public.opd_visits for select to authenticated
  using (
    exists (select 1 from public.opd_cards c where c.id = opd_visits.opd_id and c.user_id = auth.uid())
    or public.my_role() in ('doctor','admin')
    or (public.my_role() = 'medicine_staff'
        and exists (select 1 from public.medicine_requests r where r.visit_id = opd_visits.id))
  );

-- medicines: everyone signed-in can check stock; pharmacy/admin manage it
drop policy if exists medicines_select on public.medicines;
create policy medicines_select on public.medicines for select to authenticated using (true);
drop policy if exists medicines_manage on public.medicines;
create policy medicines_manage on public.medicines for all to authenticated
  using (public.my_role() in ('medicine_staff','admin'))
  with check (public.my_role() in ('medicine_staff','admin'));

-- medicine_requests: patient sees own, pharmacy/admin see all (status changes via RPC)
drop policy if exists med_requests_select on public.medicine_requests;
create policy med_requests_select on public.medicine_requests for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('medicine_staff','admin'));

-- ───────────────────────────────────────────────────────────────────────────
-- 5. RPC functions (the old controllers). SECURITY DEFINER + explicit checks.
--    Advisory locks make booking / token numbering race-safe — the old code
--    did count()+1 which could hand the same number to two patients.
-- ───────────────────────────────────────────────────────────────────────────

-- 5.1 Departments with live counts — public (powers the live queue board)
create or replace function public.get_queue_status()
returns table (
  department text, label text, icon text, room_number text,
  current_token int, next_token int,
  waiting_count int, completed_count int, total_today int,
  max_tokens_per_day int, avg_minutes_per_patient int
) language sql stable security definer set search_path = public as
$$
  select d.name, d.label, d.icon, d.room_number,
    (select t.token_number from public.tokens t
       where t.department = d.name and t.appt_date = public.hospital_today() and t.status = 'called'
       order by t.called_at desc nulls last limit 1),
    (select min(t.token_number)::int from public.tokens t
       where t.department = d.name and t.appt_date = public.hospital_today() and t.status = 'waiting'),
    (select count(*)::int from public.tokens t
       where t.department = d.name and t.appt_date = public.hospital_today() and t.status = 'waiting'),
    (select count(*)::int from public.tokens t
       where t.department = d.name and t.appt_date = public.hospital_today() and t.status = 'completed'),
    (select count(*)::int from public.tokens t
       where t.department = d.name and t.appt_date = public.hospital_today() and t.status <> 'cancelled'),
    d.max_tokens_per_day, d.avg_minutes_per_patient
  from public.departments d
  order by d.sort_order, d.name
$$;

-- 5.2 Slots left for a department on a date
create or replace function public.get_dept_slots(p_dept text, p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v_dept public.departments; v_booked int;
begin
  select * into v_dept from public.departments where name = p_dept;
  if not found then raise exception 'Unknown department.'; end if;
  select count(*) into v_booked from public.appointments
    where department = p_dept and appt_date = coalesce(p_date, public.hospital_today()) and status <> 'cancelled';
  return jsonb_build_object(
    'department', p_dept,
    'date', coalesce(p_date, public.hospital_today()),
    'max_tokens', v_dept.max_tokens_per_day,
    'booked_count', v_booked,
    'available', greatest(0, v_dept.max_tokens_per_day - v_booked),
    'avg_minutes_per_patient', v_dept.avg_minutes_per_patient
  );
end $$;

-- 5.3 Doctors of a department with how many tokens they have left on a date
create or replace function public.get_doctors(p_department text, p_date date)
returns jsonb language sql stable security definer set search_path = public as
$$
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select to_jsonb(d) || jsonb_build_object(
             'tokens_booked', b.cnt,
             'per_doctor_limit', lim.v,
             'tokens_remaining', greatest(0, lim.v - b.cnt),
             'is_full', b.cnt >= lim.v,
             'avg_minutes_per_patient', dp.avg_minutes_per_patient
           ) as x
    from public.doctors d
    join public.departments dp on dp.name = d.department
    cross join lateral (
      select count(*)::int as cnt from public.appointments a
      where a.doctor_id = d.id and a.appt_date = coalesce(p_date, public.hospital_today()) and a.status <> 'cancelled'
    ) b
    cross join lateral (
      select floor(dp.max_tokens_per_day::numeric /
             greatest((select count(*) from public.doctors d2 where d2.department = d.department and d2.is_active), 1))::int as v
    ) lim
    where d.is_active and (p_department is null or d.department = p_department)
  ) q
$$;

-- 5.4 Book an appointment (patients only)
create or replace function public.book_appointment(
  p_doctor_id bigint, p_department text, p_appt_date date, p_notes text default null
) returns public.appointments
language plpgsql security definer set search_path = public as
$$
declare
  v_uid   uuid := auth.uid();
  v_today date := public.hospital_today();
  v_dept  public.departments;
  v_doc   public.doctors;
  v_docs  int; v_limit int; v_count int;
  v_day   text;
  v_row   public.appointments;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  if public.my_role() is distinct from 'patient' then
    raise exception 'Only patient accounts can book appointments.';
  end if;
  if p_department is null or p_appt_date is null then
    raise exception 'Department and date are required.';
  end if;

  select * into v_dept from public.departments where name = p_department;
  if not found then raise exception 'Unknown department.'; end if;

  -- booking window: closes at 12:00 noon (IST) of the appointment date
  if p_appt_date = v_today and public.hospital_hour() >= 12 then
    raise exception 'Token booking for today is closed after 12:00 PM. Please try again tomorrow after 12:00 AM.';
  end if;
  if p_appt_date < v_today then
    raise exception 'Appointments cannot be booked for past dates.';
  end if;
  if p_appt_date > (v_today + interval '1 month')::date then
    raise exception 'Appointments can only be booked up to 1 month in advance.';
  end if;

  -- serialise bookings for this department+date so the limit can't be oversold
  perform pg_advisory_xact_lock(hashtext('book:' || p_department || ':' || p_appt_date::text));

  if exists (select 1 from public.appointments
             where user_id = v_uid and appt_date = p_appt_date and department = p_department
               and status in ('pending','confirmed')) then
    raise exception 'You already have an appointment for this date and department.';
  end if;

  select count(*) into v_docs from public.doctors where department = p_department and is_active;
  v_limit := floor(v_dept.max_tokens_per_day::numeric / greatest(v_docs, 1));

  if p_doctor_id is not null then
    select * into v_doc from public.doctors
      where id = p_doctor_id and department = p_department and is_active;
    if not found then raise exception 'Selected doctor is not available in this department.'; end if;

    -- doctor works on this weekday?
    v_day := to_char(p_appt_date, 'Dy');
    if coalesce(trim(v_doc.available_days), '') <> ''
       and not exists (select 1 from unnest(string_to_array(v_doc.available_days, ',')) s
                       where lower(trim(s)) = lower(v_day)) then
      raise exception '% is not available on %s. Available days: %.', v_doc.name, to_char(p_appt_date, 'FMDay'), v_doc.available_days;
    end if;

    select count(*) into v_count from public.appointments
      where doctor_id = p_doctor_id and appt_date = p_appt_date and status <> 'cancelled';
    if v_count >= v_limit then
      raise exception 'This doctor is fully booked for % (% tokens max). Please choose another doctor or date.', p_appt_date, v_limit;
    end if;
  else
    select count(*) into v_count from public.appointments
      where department = p_department and appt_date = p_appt_date and status <> 'cancelled';
    if v_count >= v_dept.max_tokens_per_day then
      raise exception '% department is fully booked for % (max % per day). Please choose another date.',
        p_department, p_appt_date, v_dept.max_tokens_per_day;
    end if;
  end if;

  insert into public.appointments (user_id, doctor_id, department, appt_date, notes)
  values (v_uid, p_doctor_id, p_department, p_appt_date, nullif(trim(p_notes), ''))
  returning * into v_row;
  return v_row;
end $$;

-- 5.5 Generate the queue token (+ unique QR id) for an appointment
--     token_uid format: OPD<DEPT3><DDMMYYYY><DOC3><PAT3><NNN>   e.g. OPDGEN23042026RAJDIV003
create or replace function public.generate_token(p_appointment_id bigint)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_uid uuid := auth.uid();
  v_appt public.appointments; v_dept public.departments;
  v_user public.profiles; v_doc public.doctors; v_tok public.tokens;
  v_issued int; v_waiting int; v_num int; v_uidtext text;
  v_dcode text; v_pcode text; v_dept3 text;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'Appointment not found.'; end if;
  if v_appt.user_id <> v_uid then raise exception 'This appointment belongs to another account.'; end if;
  if v_appt.status = 'cancelled' then raise exception 'This appointment was cancelled.'; end if;

  if v_appt.doctor_id is not null then select * into v_doc from public.doctors where id = v_appt.doctor_id; end if;

  -- idempotent: appointment already has a token → return it
  if v_appt.token_id is not null then
    select * into v_tok from public.tokens where id = v_appt.token_id;
    if found then
      return to_jsonb(v_tok) || jsonb_build_object('doctor_name', v_doc.name, 'doctor_id', v_appt.doctor_id);
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('token:' || v_appt.department || ':' || v_appt.appt_date::text));

  select * into v_dept from public.departments where name = v_appt.department;

  select count(*) into v_issued from public.tokens
    where department = v_appt.department and appt_date = v_appt.appt_date and status <> 'cancelled';
  if v_issued >= v_dept.max_tokens_per_day then
    raise exception '% department is fully booked for %. Max % tokens per day.',
      v_appt.department, v_appt.appt_date, v_dept.max_tokens_per_day;
  end if;

  if exists (select 1 from public.tokens
             where user_id = v_uid and department = v_appt.department
               and appt_date = v_appt.appt_date and status in ('waiting','called')) then
    raise exception 'You already have an active token for this date.';
  end if;

  select count(*) into v_waiting from public.tokens
    where department = v_appt.department and appt_date = v_appt.appt_date and status = 'waiting';
  -- max()+1 (not count()+1) so numbers are never reused after a cancellation
  select coalesce(max(token_number), 0) + 1 into v_num from public.tokens
    where department = v_appt.department and appt_date = v_appt.appt_date;

  select * into v_user from public.profiles where id = v_uid;

  v_dept3 := rpad(left(regexp_replace(upper(v_appt.department), '[^A-Z0-9]', '', 'g'), 3), 3, 'X');
  v_dcode := rpad(left(regexp_replace(upper(split_part(
               regexp_replace(coalesce(v_doc.name, 'DOC'), '^Dr\.?\s*', '', 'i'), ' ', 1)), '[^A-Z0-9]', '', 'g'), 3), 3, 'X');
  v_pcode := rpad(left(regexp_replace(upper(split_part(coalesce(v_user.name, 'PAT'), ' ', 1)), '[^A-Z0-9]', '', 'g'), 3), 3, 'X');
  v_uidtext := 'OPD' || v_dept3 || to_char(v_appt.appt_date, 'DDMMYYYY') || v_dcode || v_pcode || lpad(v_num::text, 3, '0');

  insert into public.tokens (user_id, doctor_id, token_number, department, room_number, status,
                             estimated_time, tokens_ahead, appt_date, token_uid)
  values (v_uid, v_appt.doctor_id, v_num, v_appt.department, v_dept.room_number, 'waiting',
          v_waiting * v_dept.avg_minutes_per_patient, v_waiting, v_appt.appt_date, v_uidtext)
  returning * into v_tok;

  update public.appointments set token_id = v_tok.id, status = 'confirmed' where id = v_appt.id;

  return to_jsonb(v_tok) || jsonb_build_object('doctor_name', v_doc.name, 'doctor_id', v_appt.doctor_id);
end $$;

-- 5.6 Cancel an appointment (and its token)
create or replace function public.cancel_appointment(p_id bigint)
returns void language plpgsql security definer set search_path = public as
$$
declare v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_id for update;
  if not found then raise exception 'Appointment not found.'; end if;
  if v_appt.user_id <> auth.uid() and public.my_role() is distinct from 'admin' then
    raise exception 'You can only cancel your own appointments.';
  end if;
  if v_appt.status = 'cancelled' then raise exception 'Already cancelled.'; end if;
  if v_appt.status = 'visited' then raise exception 'This visit is already completed.'; end if;

  if v_appt.token_id is not null then
    update public.tokens set status = 'cancelled', completed_at = now()
      where id = v_appt.token_id and status in ('waiting','called');
  end if;
  update public.appointments set status = 'cancelled' where id = p_id;
end $$;

-- 5.7 Cancel a token (and its appointment)
create or replace function public.cancel_token(p_id bigint)
returns void language plpgsql security definer set search_path = public as
$$
declare v_tok public.tokens;
begin
  select * into v_tok from public.tokens where id = p_id for update;
  if not found then raise exception 'Token not found.'; end if;
  if v_tok.user_id <> auth.uid() and public.my_role() is distinct from 'admin' then
    raise exception 'You can only cancel your own token.';
  end if;
  if v_tok.status in ('completed','cancelled') then
    raise exception 'Token already %.', v_tok.status;
  end if;
  update public.tokens set status = 'cancelled', completed_at = now() where id = p_id;
  update public.appointments set status = 'cancelled' where token_id = p_id and status <> 'visited';
end $$;

-- 5.8 Doctor calls the next waiting token of a department (today)
create or replace function public.call_next_token(p_department text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare v_tok public.tokens; v_user jsonb;
begin
  if public.my_role() not in ('doctor','admin') then
    raise exception 'Only doctors can call tokens.';
  end if;
  select * into v_tok from public.tokens
    where department = p_department and appt_date = public.hospital_today() and status = 'waiting'
    order by token_number limit 1
    for update skip locked;
  if not found then return null; end if;

  update public.tokens set status = 'called', called_at = now() where id = v_tok.id returning * into v_tok;

  select jsonb_build_object('id', id, 'name', name, 'email', email, 'photo_url', photo_url)
    into v_user from public.profiles where id = v_tok.user_id;
  return to_jsonb(v_tok) || jsonb_build_object('user', v_user);
end $$;

-- 5.9 Scan / look up a token (QR payload, typed token number, or DB id)
--     Returns {ok:true, token, opdCard, isNewPatient} or {ok:false, errorType, message, token?}
--     errorType ∈ NOT_FOUND | AMBIGUOUS | WRONG_DEPARTMENT | EXPIRED | FUTURE
create or replace function public.scan_token(p_identifier text, p_department text default null)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_id text := upper(trim(coalesce(p_identifier, '')));
  v_today date := public.hospital_today();
  v_tok public.tokens; v_found boolean := false; v_matches int;
  v_card public.opd_cards; v_user jsonb; v_visits jsonb; v_doc text;
  v_brief jsonb;
begin
  if public.my_role() not in ('doctor','admin') then
    raise exception 'Only doctors and admins can scan tokens.';
  end if;
  if v_id = '' then
    return jsonb_build_object('ok', false, 'errorType', 'NOT_FOUND', 'message', 'Enter a token number or scan a QR code.');
  end if;

  -- 1) token_uid (what the QR contains)
  if v_id like 'OPD%' then
    select * into v_tok from public.tokens where token_uid = v_id;
    v_found := found;
  end if;

  -- 2) token number for TODAY (optionally inside the doctor's department)
  if not v_found and v_id ~ '^\d{1,9}$' then
    select count(*) into v_matches from public.tokens
      where token_number = v_id::int and appt_date = v_today
        and (p_department is null or department = p_department);
    if v_matches > 1 then
      return jsonb_build_object('ok', false, 'errorType', 'AMBIGUOUS',
        'message', format('Several departments issued token #%s today. Scan the QR code or enter the full token ID.', v_id::int));
    end if;
    select * into v_tok from public.tokens
      where token_number = v_id::int and appt_date = v_today
        and (p_department is null or department = p_department)
      order by created_at desc limit 1;
    v_found := found;
  end if;

  -- 3) last resort: DB id
  if not v_found and v_id ~ '^\d{1,15}$' then
    select * into v_tok from public.tokens where id = v_id::bigint;
    v_found := found;
  end if;

  if not v_found then
    return jsonb_build_object('ok', false, 'errorType', 'NOT_FOUND',
      'message', case when p_department is not null
        then format('Token not found in %s department for today. Check the token number.', p_department)
        else 'Token not found. This token is not for today or does not exist.' end);
  end if;

  v_brief := jsonb_build_object('token_number', v_tok.token_number, 'token_uid', v_tok.token_uid,
                                'appt_date', v_tok.appt_date, 'department', v_tok.department, 'status', v_tok.status);

  if p_department is not null and v_tok.department <> p_department then
    return jsonb_build_object('ok', false, 'errorType', 'WRONG_DEPARTMENT', 'token', v_brief,
      'message', format('This token belongs to %s department, not %s. Please verify the patient is at the correct counter.',
                        v_tok.department, p_department));
  end if;

  if v_tok.appt_date < v_today then
    return jsonb_build_object('ok', false, 'errorType', 'EXPIRED', 'token', v_brief,
      'message', format('This token is for %s — it has expired and is not valid today.', to_char(v_tok.appt_date, 'DD Mon YYYY')));
  elsif v_tok.appt_date > v_today then
    return jsonb_build_object('ok', false, 'errorType', 'FUTURE', 'token', v_brief,
      'message', format('This token is for %s — not valid yet. Please come on the appointment date.', to_char(v_tok.appt_date, 'DD Mon YYYY')));
  end if;

  select jsonb_build_object('id', id, 'name', name, 'email', email, 'phone', phone, 'photo_url', photo_url)
    into v_user from public.profiles where id = v_tok.user_id;
  select name into v_doc from public.doctors where id = v_tok.doctor_id;
  select * into v_card from public.opd_cards where user_id = v_tok.user_id;

  if found then
    select coalesce(jsonb_agg(to_jsonb(v) order by v.visit_date desc, v.id desc), '[]'::jsonb) into v_visits
      from (select * from public.opd_visits where opd_id = v_card.id order by visit_date desc, id desc limit 5) v;
  end if;

  return jsonb_build_object(
    'ok', true,
    'token', to_jsonb(v_tok) || jsonb_build_object('user', v_user, 'doctor_name', v_doc),
    'opdCard', case when v_card.id is null then null else to_jsonb(v_card) || jsonb_build_object('visits', v_visits) end,
    'isNewPatient', v_card.id is null
  );
end $$;

-- 5.10 OPD card helpers
create or replace function public.new_card_number()
returns text language plpgsql volatile as
$$
declare v text;
begin
  loop
    v := 'OPD' || lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from public.opd_cards where card_number = v);
  end loop;
  return v;
end $$;

create or replace function public.create_opd_card(
  p_user_id uuid, p_blood_group text default null, p_age int default null,
  p_gender text default null, p_phone text default null, p_address text default null
) returns public.opd_cards
language plpgsql security definer set search_path = public as
$$
declare v_card public.opd_cards;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_user_id <> auth.uid() and public.my_role() not in ('doctor','admin') then
    raise exception 'You can only create your own OPD card.';
  end if;
  select * into v_card from public.opd_cards where user_id = p_user_id;
  if found then return v_card; end if;
  insert into public.opd_cards (user_id, card_number, blood_group, age, gender, phone, address)
  values (p_user_id, public.new_card_number(), nullif(p_blood_group,''), p_age, nullif(p_gender,''),
          nullif(p_phone,''), nullif(p_address,''))
  returning * into v_card;
  return v_card;
end $$;

-- 5.11 Record a consultation — ONE atomic call (old flow: 3 separate API calls
--      that could leave a half-saved visit). Creates the OPD card if missing,
--      completes the token, marks the appointment visited, and (optionally)
--      forwards the prescription to the pharmacy queue.
create or replace function public.record_visit(
  p_user_id uuid, p_token_id bigint, p_symptoms text, p_diagnosis text default null,
  p_prescription text default null, p_doctor_name text default null,
  p_follow_up date default null, p_send_to_medicine boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v_card public.opd_cards; v_visit public.opd_visits; v_req public.medicine_requests;
begin
  if public.my_role() not in ('doctor','admin') then
    raise exception 'Only doctors can record visits.';
  end if;
  if coalesce(trim(p_symptoms), '') = '' then raise exception 'Symptoms are required.'; end if;

  select * into v_card from public.opd_cards where user_id = p_user_id;
  if not found then
    insert into public.opd_cards (user_id, card_number)
    values (p_user_id, public.new_card_number()) returning * into v_card;
  end if;

  insert into public.opd_visits (opd_id, token_id, symptoms, diagnosis, prescription, doctor_name, follow_up_date)
  values (v_card.id, p_token_id, trim(p_symptoms), nullif(trim(p_diagnosis), ''), nullif(trim(p_prescription), ''),
          nullif(trim(p_doctor_name), ''), p_follow_up)
  returning * into v_visit;

  if p_token_id is not null then
    update public.tokens set status = 'completed', completed_at = now() where id = p_token_id;
    update public.appointments set status = 'visited' where token_id = p_token_id;
  end if;

  if p_send_to_medicine and coalesce(trim(p_prescription), '') <> '' then
    insert into public.medicine_requests (visit_id, user_id, token_id, prescription_text)
    values (v_visit.id, p_user_id, p_token_id, trim(p_prescription))
    returning * into v_req;
  end if;

  return jsonb_build_object('visit', to_jsonb(v_visit), 'medicineRequest', to_jsonb(v_req));
end $$;

-- 5.12 Pharmacy: move a prescription request through its stages
create or replace function public.update_medicine_request(p_id bigint, p_status text, p_notes text default null)
returns public.medicine_requests
language plpgsql security definer set search_path = public as
$$
declare v_row public.medicine_requests;
begin
  if public.my_role() not in ('medicine_staff','admin') then
    raise exception 'Only pharmacy staff can update prescriptions.';
  end if;
  if p_status not in ('pending','preparing','ready','dispensed') then
    raise exception 'Invalid status.';
  end if;
  update public.medicine_requests
     set status = p_status,
         admin_notes = coalesce(nullif(trim(p_notes), ''), admin_notes),
         ready_at = case when p_status = 'ready' then now() else ready_at end
   where id = p_id returning * into v_row;
  if not found then raise exception 'Request not found.'; end if;
  return v_row;
end $$;

-- 5.13 Doctors edit their OWN listing (spec / room / days only)
create or replace function public.update_my_doctor_profile(
  p_specialization text, p_room_number text, p_available_days text
) returns public.doctors
language plpgsql security definer set search_path = public as
$$
declare v_row public.doctors;
begin
  if public.my_role() is distinct from 'doctor' then raise exception 'Doctors only.'; end if;
  update public.doctors
     set specialization = nullif(trim(p_specialization), ''),
         room_number    = nullif(trim(p_room_number), ''),
         available_days = coalesce(nullif(trim(p_available_days), ''), available_days)
   where user_id = auth.uid() returning * into v_row;
  if not found then raise exception 'Your account is not linked to a doctor profile yet. Ask the admin.'; end if;
  return v_row;
end $$;

-- 5.14 Admin: change a user's role (keeps the doctor listing in sync)
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as
$$
declare v_name text; v_dept text;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only.'; end if;
  if p_role not in ('patient','doctor','admin','medicine_staff') then raise exception 'Invalid role.'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role.'; end if;

  update public.profiles set role = p_role where id = p_user_id returning name into v_name;
  if not found then raise exception 'User not found.'; end if;

  if p_role = 'doctor' then
    if not exists (select 1 from public.doctors where user_id = p_user_id) then
      select name into v_dept from public.departments order by sort_order, name limit 1;
      insert into public.doctors (user_id, name, department) values (p_user_id, v_name, v_dept);
    else
      update public.doctors set is_active = true where user_id = p_user_id;
    end if;
  else
    update public.doctors set is_active = false where user_id = p_user_id;
  end if;
end $$;

-- 5.15 Admin: finish creating a staff account (the account itself is created
--      from the browser with auth.signUp on a throw-away client — see README)
create or replace function public.admin_finalize_staff(
  p_user_id uuid, p_role text, p_name text, p_phone text default null,
  p_department text default null, p_specialization text default null, p_room_number text default null
) returns void language plpgsql security definer set search_path = public as
$$
declare v_dept text;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only.'; end if;
  if p_role not in ('doctor','medicine_staff','admin') then raise exception 'Invalid role.'; end if;

  update public.profiles
     set role = p_role,
         name = coalesce(nullif(trim(p_name), ''), name),
         phone = nullif(trim(p_phone), '')
   where id = p_user_id;
  if not found then raise exception 'Account not found — has the user been created yet?'; end if;

  if p_role = 'doctor' and not exists (select 1 from public.doctors where user_id = p_user_id) then
    v_dept := coalesce(nullif(p_department, ''), (select name from public.departments order by sort_order, name limit 1));
    insert into public.doctors (user_id, name, department, specialization, room_number)
    values (p_user_id, coalesce(nullif(trim(p_name), ''), 'Doctor'), v_dept,
            nullif(trim(p_specialization), ''), nullif(trim(p_room_number), ''));
  end if;
end $$;

-- 5.16 Admin: delete a user completely (auth account + everything linked to it)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as
$$
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Admins only.'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot delete your own account.'; end if;
  delete from auth.users where id = p_user_id;   -- cascades to profiles → cards, tokens, ...
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Function privileges: signed-in users only, except the public queue board
-- ───────────────────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
grant  execute on function public.get_queue_status()    to anon;
grant  execute on function public.hospital_today()      to anon;
grant  execute on function public.hospital_hour()       to anon;
-- trigger helpers never need to be called by clients
revoke execute on function public.handle_new_user()         from authenticated;
revoke execute on function public.protect_profile_columns() from authenticated;
revoke execute on function public.touch_queue_from_tokens()      from authenticated;
revoke execute on function public.touch_queue_from_departments() from authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Realtime
-- ───────────────────────────────────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table public.queue_state;       exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.medicine_requests; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tokens;           exception when others then null; end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Seed data (same demo data the old server.js created on first start)
-- ───────────────────────────────────────────────────────────────────────────
insert into public.departments (name, label, icon, room_number, floor, description, color, max_tokens_per_day, avg_minutes_per_patient, sort_order) values
  ('General',     'General OPD', '🏥', 'OPD-101', 'Ground', 'General OPD',         '#2563eb', 80,  8, 1),
  ('ENT',         'ENT',         '👂', 'OPD-205', '2nd',    'Ear, Nose & Throat',  '#7c3aed', 50, 10, 2),
  ('Cardiology',  'Cardiology',  '❤️', 'OPD-310', '3rd',    'Heart & Vascular',    '#dc2626', 40, 15, 3),
  ('Orthopedics', 'Orthopedics', '🦴', 'OPD-412', '4th',    'Bone & Joint',        '#d97706', 40, 15, 4),
  ('Pediatrics',  'Pediatrics',  '👶', 'OPD-115', 'Ground', 'Children',            '#059669', 60, 10, 5)
on conflict (name) do nothing;

insert into public.doctors (name, department, room_number, specialization)
select * from (values
  ('Dr. Rajesh Sharma', 'General',     'OPD-101', 'General Physician'),
  ('Dr. Priya Mehta',   'General',     'OPD-102', 'General Physician'),
  ('Dr. Anil Kumar',    'ENT',         'OPD-205', 'ENT Specialist'),
  ('Dr. Sunita Rao',    'Cardiology',  'OPD-310', 'Cardiologist'),
  ('Dr. Vikram Singh',  'Orthopedics', 'OPD-412', 'Orthopedic Surgeon'),
  ('Dr. Kavya Nair',    'Pediatrics',  'OPD-115', 'Pediatrician')
) as v(name, department, room_number, specialization)
where not exists (select 1 from public.doctors);

insert into public.medicines (name, category, stock, unit)
select * from (values
  ('Paracetamol 500mg',  'Analgesic',     500, 'tablet'),
  ('Amoxicillin 250mg',  'Antibiotic',    200, 'capsule'),
  ('Omeprazole 20mg',    'Antacid',       300, 'capsule'),
  ('Cetirizine 10mg',    'Antihistamine', 150, 'tablet'),
  ('Metformin 500mg',    'Antidiabetic',    0, 'tablet'),
  ('Atorvastatin 10mg',  'Statin',        100, 'tablet'),
  ('Azithromycin 500mg', 'Antibiotic',     80, 'tablet'),
  ('Ibuprofen 400mg',    'NSAID',         250, 'tablet')
) as v(name, category, stock, unit)
where not exists (select 1 from public.medicines);

insert into public.queue_state (department)
select name from public.departments on conflict do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 9. YOUR FIRST ADMIN
--    1) Open the app and register normally with your email.
--    2) Run this in the SQL editor (replace the email), then sign in again:
--
--    update public.profiles set role = 'admin' where email = 'you@example.com';
--
--    From then on, create doctors / pharmacy staff from the Admin panel.
-- ───────────────────────────────────────────────────────────────────────────
