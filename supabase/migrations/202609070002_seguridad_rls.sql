-- ============================================================
-- RLS y permisos por rol
-- IMPORTANTE: estas políticas se agregan con nombres propios y NO eliminan
-- políticas antiguas ajenas a este repositorio. Revisa SECURITY.md si tu
-- proyecto ya tenía RLS configurado.
-- ============================================================

create or replace function public.usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and activo = true
  );
$$;

create or replace function public.usuario_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and activo = true
      and rol = 'admin'
  );
$$;

revoke all on function public.usuario_activo() from public;
revoke all on function public.usuario_admin() from public;
grant execute on function public.usuario_activo() to authenticated;
grant execute on function public.usuario_admin() to authenticated;

-- Tablas comerciales: admin y trabajador activos.
alter table public.clientes enable row level security;
alter table public.proveedores enable row level security;
alter table public.productos enable row level security;
alter table public.producto_proveedor enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;

-- Perfil: cada persona ve su perfil; admin puede verlos todos.
alter table public.profiles enable row level security;
drop policy if exists "lu_profiles_select" on public.profiles;
create policy "lu_profiles_select"
on public.profiles for select to authenticated
using (id = auth.uid() or public.usuario_admin());

-- Comercial.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'proveedores', 'productos', 'producto_proveedor',
    'cotizaciones', 'cotizacion_items'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'lu_' || t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.usuario_activo()) with check (public.usuario_activo())',
      'lu_' || t || '_all', t
    );
  end loop;
end
$$;

-- Configuración: lectura para usuarios activos (cotizaciones la necesita), escritura solo admin.
alter table public.configuracion_empresa enable row level security;
drop policy if exists "lu_config_select" on public.configuracion_empresa;
create policy "lu_config_select"
on public.configuracion_empresa for select to authenticated
using (public.usuario_activo());

drop policy if exists "lu_config_admin_write" on public.configuracion_empresa;
create policy "lu_config_admin_write"
on public.configuracion_empresa for all to authenticated
using (public.usuario_admin())
with check (public.usuario_admin());

-- Finanzas: solo administradores.
do $$
declare
  t text;
begin
  foreach t in array array[
    'pagos_clientes', 'pagos_proveedores', 'gastos',
    'categorias_gasto', 'impuestos_mensuales'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'lu_' || t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.usuario_admin()) with check (public.usuario_admin())',
      'lu_' || t || '_admin', t
    );
  end loop;
end
$$;

-- La tabla interna de correlativos no se expone directamente.
revoke all on table public.cotizacion_correlativos from anon, authenticated;

-- Logo de empresa: lectura para usuarios activos y escritura solo admin.
drop policy if exists "lu_storage_assets_select" on storage.objects;
create policy "lu_storage_assets_select"
on storage.objects for select to authenticated
using (bucket_id = 'assets' and public.usuario_activo());

drop policy if exists "lu_storage_assets_admin_insert" on storage.objects;
create policy "lu_storage_assets_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assets'
  and name = 'Logo/Logo.png'
  and public.usuario_admin()
);

drop policy if exists "lu_storage_assets_admin_update" on storage.objects;
create policy "lu_storage_assets_admin_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'assets'
  and name = 'Logo/Logo.png'
  and public.usuario_admin()
)
with check (
  bucket_id = 'assets'
  and name = 'Logo/Logo.png'
  and public.usuario_admin()
);
