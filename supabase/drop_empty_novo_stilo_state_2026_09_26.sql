-- One-time removal of the empty legacy table after the data cleanup.
-- RESTRICT prevents deleting dependent application objects by accident.
begin;
do $cleanup$
begin
  if (select count(*) from public.novo_stilo_state) <> 0 then
    raise exception 'Legacy state table is no longer empty; drop canceled';
  end if;
end;
$cleanup$;
drop table public.novo_stilo_state restrict;
commit;
