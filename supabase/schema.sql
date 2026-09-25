-- Sistema LsBarber - estrutura inicial para sincronização com Supabase
-- Execute este arquivo no SQL Editor do Supabase antes de usar o sistema.

-- Remove a estrutura e os dados do sistema anterior.
drop table if exists public.novo_stilo_state;

create table if not exists public.lsbarber_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.lsbarber_state enable row level security;

-- Permite que o app Vite leia e salve o estado usando a chave pública do projeto.
-- Esta política é indicada apenas para a primeira entrega sem login.
-- Na próxima etapa, troque por políticas usando auth.uid() e usuários autenticados.
drop policy if exists "Sistema LsBarber pode ler estado" on public.lsbarber_state;
drop policy if exists "Sistema LsBarber pode inserir estado" on public.lsbarber_state;
drop policy if exists "Sistema LsBarber pode atualizar estado" on public.lsbarber_state;

create policy "Sistema LsBarber pode ler estado"
on public.lsbarber_state
for select
to anon, authenticated
using (id = 'lsbarber');

create policy "Sistema LsBarber pode inserir estado"
on public.lsbarber_state
for insert
to anon, authenticated
with check (id = 'lsbarber');

create policy "Sistema LsBarber pode atualizar estado"
on public.lsbarber_state
for update
to anon, authenticated
using (id = 'lsbarber')
with check (id = 'lsbarber');

grant select, insert, update on public.lsbarber_state to anon, authenticated;
