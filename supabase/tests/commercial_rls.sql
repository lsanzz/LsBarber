-- Read/write isolation smoke test against a project with one active subscription
-- and a second Auth user. Everything written is rolled back.
begin;
do $$
declare table_name text;
begin
  if has_table_privilege('authenticated', 'public.salon_workspaces', 'INSERT, UPDATE, DELETE') then
    raise exception 'Authenticated role can bypass workspace version checks with direct writes';
  end if;
  if not has_table_privilege('authenticated', 'public.salon_workspaces', 'SELECT') then
    raise exception 'Authenticated role cannot export its workspace';
  end if;
  foreach table_name in array array[
    'billing_checkout_locks', 'billing_customers', 'billing_subscriptions',
    'billing_environment', 'salon_workspaces', 'appointments', 'clients',
    'products', 'professionals', 'sale_items', 'sales', 'services', 'settings'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null
      and has_table_privilege('anon', format('public.%I', table_name), 'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'Anonymous role has business table privileges: %', table_name;
    end if;
  end loop;
  foreach table_name in array array[
    'appointments', 'clients', 'products', 'professionals',
    'sale_items', 'sales', 'services', 'settings'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null
      and has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'Legacy shared table is reachable by authenticated users: %', table_name;
    end if;
  end loop;
end;
$$;
select set_config('app.test_owner', (
  select user_id::text from public.billing_subscriptions
  where status in ('active', 'trialing') and livemode = false order by event_time desc limit 1
), true);
select set_config('app.test_outsider', (
  select id::text from auth.users where id <> current_setting('app.test_owner')::uuid limit 1
), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.test_owner'), true);
do $$
declare empty_workspace jsonb := '{"settings":{},"professionals":[],"services":[],"clients":[],"appointments":[],"products":[],"sales":[]}'::jsonb;
        conflict_seen boolean := false;
begin
  if public.workspace_plan_limit(auth.uid()) < 1 then raise exception 'Paid owner has no plan limit'; end if;
  if public.save_workspace_state(auth.uid(), 0, empty_workspace) <> 1 then raise exception 'Workspace creation failed'; end if;
  if (select count(*) from public.salon_workspaces) <> 1 then raise exception 'Owner cannot read own workspace'; end if;
  begin
    perform public.save_workspace_state(auth.uid(), 0, empty_workspace);
  exception when sqlstate 'P0001' then conflict_seen := true;
  end;
  if not conflict_seen then raise exception 'Stale version was accepted'; end if;
  begin
    perform public.save_workspace_state(current_setting('app.test_outsider')::uuid, 0, empty_workspace);
    raise exception 'A write for another account was accepted';
  exception when sqlstate '42501' then null;
  end;
  if public.workspace_write_allowed(auth.uid(), jsonb_set(empty_workspace, '{professionals}',
    (select jsonb_agg('{}'::jsonb) from generate_series(1, 9)))) then
    raise exception 'Nine professionals bypassed the Pro cap';
  end if;
  if public.save_workspace_state(auth.uid(), 1, jsonb_set(empty_workspace, '{professionals}',
    (select jsonb_agg('{}'::jsonb) from generate_series(1, 3)))) <> 2 then
    raise exception 'Pro workspace could not add three professionals';
  end if;
end;
$$;
reset role;
update public.billing_environment set live_mode = true, updated_at = now() where id = true;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.test_owner'), true);
do $$
begin
  if (select live_mode from public.billing_environment where id = true) is distinct from true then
    raise exception 'Authenticated user cannot read billing mode';
  end if;
  if public.workspace_plan_limit(auth.uid()) <> 0 then
    raise exception 'Test subscription still grants access in live mode';
  end if;
end;
$$;
reset role;
update public.billing_environment set live_mode = false, updated_at = now() where id = true;
insert into public.billing_subscriptions
  (stripe_subscription_id, user_id, plan, cycle, status, event_time)
values ('sub_commercial_rls_latest_basic', current_setting('app.test_owner')::uuid,
        'basico', 'monthly', 'active', 9999999998);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.test_owner'), true);
do $$
declare empty_workspace jsonb := '{"settings":{},"professionals":[],"services":[],"clients":[],"appointments":[],"products":[],"sales":[]}'::jsonb;
begin
  if public.workspace_plan_limit(auth.uid()) <> 1 then raise exception 'Downgraded limit is not Basic'; end if;
  if public.save_workspace_state(auth.uid(), 2, jsonb_set(empty_workspace, '{professionals}',
    (select jsonb_agg('{}'::jsonb) from generate_series(1, 2)))) <> 3 then
    raise exception 'Cannot reduce over-limit professionals from three to two';
  end if;
  begin
    perform public.save_workspace_state(auth.uid(), 3, jsonb_set(empty_workspace, '{professionals}',
      (select jsonb_agg('{}'::jsonb) from generate_series(1, 3))));
    raise exception 'Downgraded plan accepted an increase above its limit';
  exception when sqlstate '42501' then null;
  end;
  if public.save_workspace_state(auth.uid(), 3, jsonb_set(empty_workspace, '{professionals}',
    (select jsonb_agg('{}'::jsonb) from generate_series(1, 1)))) <> 4 then
    raise exception 'Cannot reduce over-limit professionals to the Basic cap';
  end if;
end;
$$;
reset role;
insert into public.billing_subscriptions
  (stripe_subscription_id, user_id, plan, cycle, status, event_time)
values ('sub_commercial_rls_latest_cancelled', current_setting('app.test_owner')::uuid,
        'pro', 'monthly', 'canceled', 9999999999);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.test_owner'), true);
do $$
begin
  if public.workspace_plan_limit(auth.uid()) <> 0 then
    raise exception 'An older active subscription still grants access after a newer cancellation';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', current_setting('app.test_outsider'), true);
do $$
declare empty_workspace jsonb := '{"settings":{},"professionals":[],"services":[],"clients":[],"appointments":[],"products":[],"sales":[]}'::jsonb;
begin
  if (select count(*) from public.salon_workspaces) <> 0 then raise exception 'Cross-account workspace read is possible'; end if;
  if public.workspace_plan_limit(auth.uid()) <> 0 then raise exception 'Unsubscribed account has a plan limit'; end if;
  begin
    perform public.save_workspace_state(auth.uid(), 0, empty_workspace);
    raise exception 'Unsubscribed account created a workspace';
  exception when sqlstate '42501' then null;
  end;
end;
$$;
rollback;
