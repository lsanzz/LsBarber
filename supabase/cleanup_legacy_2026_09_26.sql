-- One-time cleanup requested for records left by the original Novo Stilo demo.
-- The four exact IDs were inspected before execution. Do not rerun this file.
-- Billing, Auth and owner workspaces are intentionally untouched.
begin;
do $cleanup$
declare affected integer;
begin
  if (select count(*) from public.clients) <> 1
    or (select count(*) from public.professionals) <> 1
    or (select count(*) from public.services) <> 1
    or (select count(*) from public.settings) <> 1
    or (select count(*) from public.appointments) <> 0
    or (select count(*) from public.sales) <> 0
    or (select count(*) from public.sale_items) <> 0
    or (select count(*) from public.products) <> 0
    or (select count(*) from public.novo_stilo_state) <> 0 then
    raise exception 'Legacy data changed after inspection; cleanup canceled';
  end if;

  delete from public.clients where id = '7lpfl26p';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Expected client not found'; end if;

  delete from public.professionals where id = 'adoz6t3e';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Expected professional not found'; end if;

  delete from public.services where id = '8fvfdp6q';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Expected service not found'; end if;

  delete from public.settings where id = 'salao-novo-stilo';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Expected settings not found'; end if;
end;
$cleanup$;
commit;
