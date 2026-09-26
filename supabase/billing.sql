-- Additive billing schema. Execute separately; does not reset existing business data.
begin;
create table if not exists public.billing_checkout_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.billing_checkout_locks enable row level security;
revoke all on public.billing_checkout_locks from anon, authenticated;
grant all on public.billing_checkout_locks to service_role;
create or replace function public.acquire_billing_lock(p_user uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare affected integer;
begin
  insert into public.billing_checkout_locks(user_id, token, expires_at)
  values(p_user, p_token, now() + interval '5 minutes')
  on conflict(user_id) do update set token = excluded.token, expires_at = excluded.expires_at
  where billing_checkout_locks.expires_at < now();
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.acquire_billing_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.acquire_billing_lock(uuid, uuid) to service_role;
create table if not exists public.billing_customers (
  user_id uuid not null references auth.users(id) on delete cascade,
  livemode boolean not null default false,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, livemode)
);
alter table public.billing_customers add column if not exists livemode boolean not null default false;
-- Existing sandbox installations had a primary key only on user_id.
alter table public.billing_customers drop constraint if exists billing_customers_pkey;
alter table public.billing_customers add constraint billing_customers_pkey primary key (user_id, livemode);
create table if not exists public.billing_subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  livemode boolean not null default false,
  plan text not null check (plan in ('basico', 'plus', 'pro')),
  cycle text not null check (cycle in ('monthly', 'annual')),
  status text not null,
  cancel_at_period_end boolean not null default false,
  event_time bigint not null,
  updated_at timestamptz not null default now()
);
alter table public.billing_subscriptions add column if not exists livemode boolean not null default false;
-- Fail closed when the billing environment is absent or does not match the key.
create table if not exists public.billing_environment (
  id boolean primary key default true check (id),
  live_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.billing_environment (id, live_mode) values (true, false) on conflict (id) do nothing;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_environment enable row level security;
revoke all on public.billing_customers, public.billing_subscriptions from anon, authenticated;
grant select on public.billing_customers, public.billing_subscriptions to authenticated;
grant all on public.billing_customers, public.billing_subscriptions to service_role;
revoke all on public.billing_environment from anon, authenticated;
grant select on public.billing_environment to authenticated;
grant all on public.billing_environment to service_role;
drop policy if exists "Read own billing customer" on public.billing_customers;
create policy "Read own billing customer" on public.billing_customers for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Read own subscription" on public.billing_subscriptions;
create policy "Read own subscription" on public.billing_subscriptions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Read billing environment" on public.billing_environment;
create policy "Read billing environment" on public.billing_environment for select to authenticated using (true);

-- Atomic duplicate/out-of-order event handling. Only the verified server webhook can write.
drop function if exists public.save_billing_subscription(text, uuid, text, text, text, bigint, boolean);
create or replace function public.save_billing_subscription(p_id text, p_user uuid, p_livemode boolean, p_status text, p_plan text, p_cycle text, p_event_time bigint, p_cancel_at_end boolean)
returns void language sql security invoker set search_path = public as $$
  insert into public.billing_subscriptions(stripe_subscription_id, user_id, livemode, status, plan, cycle, event_time, cancel_at_period_end)
  values (p_id, p_user, p_livemode, p_status, p_plan, p_cycle, p_event_time, p_cancel_at_end)
  on conflict (stripe_subscription_id) do update set
    livemode = excluded.livemode, status = excluded.status, plan = excluded.plan, cycle = excluded.cycle,
    event_time = excluded.event_time, cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now()
  where billing_subscriptions.event_time <= excluded.event_time;
$$;
revoke all on function public.save_billing_subscription(text, uuid, boolean, text, text, text, bigint, boolean) from public, anon, authenticated;
grant execute on function public.save_billing_subscription(text, uuid, boolean, text, text, text, bigint, boolean) to service_role;
commit;
