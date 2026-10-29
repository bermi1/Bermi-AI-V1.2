-- Bermi Life OS foundation. Additive and backward-compatible: only creates new
-- objects (no existing table is altered or dropped). Applied to Supabase via
-- the SQL editor / MCP; SQLite creates the equivalent tables on startup
-- (server/src/storage/sqlite.js). RLS is enabled with NO policies: these tables
-- are reachable only through the server's service-role key, never from a browser.

create table if not exists bermi_life_items (
  user_id    uuid        not null,
  id         text        not null,
  kind       text        not null,
  data       jsonb       not null default '{}'::jsonb,
  when_key   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists bermi_life_items_kind on bermi_life_items (user_id, kind, when_key);
alter table bermi_life_items enable row level security;

-- Append-only credit ledger: balance = SUM(amount). idem_key makes every
-- operation idempotent so a retried request can never be charged twice.
create table if not exists bermi_credit_ledger (
  id         bigserial   primary key,
  user_id    uuid        not null,
  idem_key   text        not null,
  kind       text        not null,   -- grant | reserve | settle | refund | adjust
  amount     integer     not null,   -- signed
  feature    text,
  ref        text,
  meta       jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idem_key)
);
create index if not exists bermi_credit_ledger_user on bermi_credit_ledger (user_id, id);
create index if not exists bermi_credit_ledger_time on bermi_credit_ledger (created_at);
alter table bermi_credit_ledger enable row level security;

create table if not exists bermi_audit_log (
  id         bigserial   primary key,
  actor      text        not null,
  action     text        not null,
  target     text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
alter table bermi_audit_log enable row level security;

-- Atomic apply: serialises per user with an advisory lock, so two simultaneous
-- requests can never overspend the same balance.
create or replace function bermi_credit_apply(
  p_user uuid, p_idem text, p_kind text, p_amount integer,
  p_feature text, p_ref text, p_meta jsonb, p_require_balance boolean
) returns table (ok boolean, duplicate boolean, balance integer)
language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  select coalesce(sum(amount), 0) into bal from bermi_credit_ledger where user_id = p_user;
  if exists (select 1 from bermi_credit_ledger where user_id = p_user and idem_key = p_idem) then
    return query select true, true, bal; return;
  end if;
  if p_require_balance and bal + p_amount < 0 then
    return query select false, false, bal; return;
  end if;
  insert into bermi_credit_ledger (user_id, idem_key, kind, amount, feature, ref, meta)
    values (p_user, p_idem, p_kind, p_amount, p_feature, p_ref, p_meta);
  return query select true, false, bal + p_amount;
end $$;
revoke all on function bermi_credit_apply(uuid, text, text, integer, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function bermi_credit_apply(uuid, text, text, integer, text, text, jsonb, boolean) to service_role;

create or replace function bermi_life_adoption()
returns table (kind text, users bigint, items bigint)
language sql security definer set search_path = public as $$
  select kind, count(distinct user_id), count(*) from bermi_life_items group by kind
$$;
revoke all on function bermi_life_adoption() from public, anon, authenticated;
grant execute on function bermi_life_adoption() to service_role;

create or replace function bermi_credit_usage(p_since timestamptz)
returns table (feature text, n bigint, spent bigint)
language sql security definer set search_path = public as $$
  select coalesce(feature, 'other'), count(*), -sum(amount)::bigint
  from bermi_credit_ledger where kind in ('reserve','settle','refund') and created_at >= p_since
  group by 1
$$;
revoke all on function bermi_credit_usage(timestamptz) from public, anon, authenticated;
grant execute on function bermi_credit_usage(timestamptz) to service_role;
