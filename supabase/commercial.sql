-- Run after billing.sql. This migration does not delete existing business data.
-- Each account owns exactly one workspace; the publishable key cannot access another.
begin;
create table if not exists public.salon_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.salon_workspaces enable row level security;
revoke all on public.salon_workspaces from anon, authenticated;
-- All mutations must pass through save_workspace_state so a client cannot
-- bypass the version check with a direct PostgREST insert or update.
grant select on public.salon_workspaces to authenticated;
grant all on public.salon_workspaces to service_role;

create or replace function public.workspace_plan_limit(p_owner uuid)
returns integer language sql stable security invoker set search_path = public as $$
  select coalesce((
    select case when status not in ('active', 'trialing') then 0
      when plan = 'basico' then 1 when plan = 'plus' then 3
      when plan = 'pro' then 8 else 0 end
    from public.billing_subscriptions
    where user_id = p_owner
      and livemode = (select live_mode from public.billing_environment where id = true)
    order by event_time desc, updated_at desc limit 1
  ), 0);
$$;
revoke all on function public.workspace_plan_limit(uuid) from public, anon;
grant execute on function public.workspace_plan_limit(uuid) to authenticated, service_role;

create or replace function public.workspace_write_allowed(p_owner uuid, p_data jsonb)
returns boolean language sql stable security invoker set search_path = public as $$
  select p_owner = (select auth.uid())
    and jsonb_typeof(p_data) = 'object'
    and jsonb_typeof(p_data->'professionals') = 'array'
    and jsonb_typeof(p_data->'services') = 'array'
    and jsonb_typeof(p_data->'clients') = 'array'
    and jsonb_typeof(p_data->'appointments') = 'array'
    and jsonb_typeof(p_data->'products') = 'array'
    and jsonb_typeof(p_data->'sales') = 'array'
    and public.workspace_plan_limit(p_owner) > 0
    and (
      jsonb_array_length(p_data->'professionals') <= public.workspace_plan_limit(p_owner)
      or jsonb_array_length(p_data->'professionals') < (
        select jsonb_array_length(data->'professionals')
        from public.salon_workspaces where owner_id = p_owner
      )
    )
    and pg_column_size(p_data) <= 10485760;
$$;
revoke all on function public.workspace_write_allowed(uuid, jsonb) from public, anon;
grant execute on function public.workspace_write_allowed(uuid, jsonb) to authenticated, service_role;

drop policy if exists "Owner reads workspace" on public.salon_workspaces;
create policy "Owner reads workspace" on public.salon_workspaces
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Subscribed owner creates workspace" on public.salon_workspaces;
drop policy if exists "Subscribed owner updates workspace" on public.salon_workspaces;

-- Atomic compare-and-swap prevents another tab from silently overwriting edits.
drop function if exists public.save_workspace_state(bigint, jsonb);
create or replace function public.save_workspace_state(p_owner uuid, p_expected_version bigint, p_data jsonb)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare next_version bigint;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if p_owner is distinct from (select auth.uid()) or not public.workspace_write_allowed(p_owner, p_data) then
    raise exception 'Subscription or plan limit does not allow this change' using errcode = '42501';
  end if;
  if p_expected_version = 0 then
    insert into public.salon_workspaces(owner_id, data, version)
    values (p_owner, p_data, 1)
    on conflict (owner_id) do nothing
    returning version into next_version;
  else
    update public.salon_workspaces
    set data = p_data, version = version + 1, updated_at = now()
    where owner_id = p_owner and version = p_expected_version
    returning version into next_version;
  end if;
  if next_version is null then raise exception 'Workspace version conflict' using errcode = 'P0001'; end if;
  return next_version;
end;
$$;
revoke all on function public.save_workspace_state(uuid, bigint, jsonb) from public, anon;
grant execute on function public.save_workspace_state(uuid, bigint, jsonb) to authenticated;

-- Legacy shared tables must never remain reachable with the public API key.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'lsbarber_state', 'novo_stilo_state', 'appointments', 'clients', 'products',
    'professionals', 'sale_items', 'sales', 'services', 'settings'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      -- These old shared policies must not revive access after a future grant.
      execute format('drop policy if exists %I on public.%I', 'authenticated_read_' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'authenticated_write_' || table_name, table_name);
    end if;
  end loop;
end;
$$;
commit;
