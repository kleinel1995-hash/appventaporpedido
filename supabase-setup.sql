-- Ejecuta este SQL en Supabase > SQL Editor
create table if not exists public.app_data (
  id text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;
grant select, insert, update, delete on public.app_data to authenticated;

-- Los usuarios autenticados de este proyecto comparten los datos del negocio.
drop policy if exists "Authenticated users can read app data" on public.app_data;
create policy "Authenticated users can read app data"
on public.app_data for select to authenticated using (true);

drop policy if exists "Authenticated users can insert app data" on public.app_data;
create policy "Authenticated users can insert app data"
on public.app_data for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update app data" on public.app_data;
create policy "Authenticated users can update app data"
on public.app_data for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete app data" on public.app_data;
create policy "Authenticated users can delete app data"
on public.app_data for delete to authenticated using (true);

-- Habilita Realtime para que los cambios lleguen a los demás dispositivos.
alter publication supabase_realtime add table public.app_data;
