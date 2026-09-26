-- Mode-scoped customer mapping and RLS smoke test; no rows persist.
begin;
select set_config('app.test_owner', (
  select user_id::text from public.billing_customers where livemode = false limit 1
), true);
select set_config('app.test_outsider', (
  select id::text from auth.users where id <> current_setting('app.test_owner')::uuid limit 1
), true);
insert into public.billing_customers (user_id, livemode, stripe_customer_id)
values (current_setting('app.test_owner')::uuid, true, 'cus_lsbarber_billing_mode_test');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.test_owner'), true);
do $$
begin
  if (select count(*) from public.billing_customers where user_id = auth.uid()) <> 2 then
    raise exception 'One account cannot have separate test and live Stripe customers';
  end if;
  if has_table_privilege('authenticated', 'public.billing_customers', 'INSERT') then
    raise exception 'Authenticated clients can create billing customer mappings';
  end if;
  if (select live_mode from public.billing_environment where id = true) is distinct from false then
    raise exception 'Sandbox mode is not visible to the authenticated user';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', current_setting('app.test_outsider'), true);
do $$
begin
  if exists (select 1 from public.billing_customers where stripe_customer_id = 'cus_lsbarber_billing_mode_test') then
    raise exception 'Another account can read the live Stripe customer mapping';
  end if;
end;
$$;
rollback;
