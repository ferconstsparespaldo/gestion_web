-- ============================================================
-- Sectores (obras/desarrollos donde trabaja la empresa)
-- Ejecutar DESPUÉS de:
--   202609060000_esquema_base.sql
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
--   202609080001_eliminacion_admin.sql
-- ============================================================

create table if not exists public.sectores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sectores_updated_at on public.sectores;
create trigger trg_sectores_updated_at
before update on public.sectores
for each row execute function public.set_updated_at();

-- Mismo resguardo que clientes/productos/proveedores: solo un admin puede
-- desactivar o borrar un sector directamente por la API.
drop trigger if exists trg_sectores_activo_solo_admin on public.sectores;
create trigger trg_sectores_activo_solo_admin
before update of activo on public.sectores
for each row
when (old.activo is distinct from new.activo)
execute function public.exigir_admin_operacion();

drop trigger if exists trg_sectores_delete_solo_admin on public.sectores;
create trigger trg_sectores_delete_solo_admin
before delete on public.sectores
for each row
execute function public.exigir_admin_operacion();

create or replace function public.desactivar_sector_admin(
  p_sector_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_admin() then
    raise exception 'Solo un administrador puede eliminar sectores.';
  end if;

  update public.sectores
  set activo = false,
      updated_at = now()
  where id = p_sector_id;

  if not found then
    raise exception 'No se encontró el sector.';
  end if;
end;
$$;

revoke all on function public.desactivar_sector_admin(uuid) from public;
grant execute on function public.desactivar_sector_admin(uuid) to authenticated;

-- Comercial: mismo nivel de acceso que clientes/proveedores (cualquier
-- usuario activo puede crear/editar; la baja queda restringida por el
-- trigger + RPC de arriba).
alter table public.sectores enable row level security;

drop policy if exists "lu_sectores_all" on public.sectores;
create policy "lu_sectores_all"
on public.sectores for all to authenticated
using (public.usuario_activo())
with check (public.usuario_activo());

-- Sectores donde trabaja Ferconst SpA (ver Ferconst SpA Instrucciones.txt).
insert into public.sectores (nombre)
select nombre from (
  values
    ('DV EL CAPRICHO'),
    ('DV LAS MURALLAS'),
    ('DV LOS CLONQUIS'),
    ('DV LOS CURUROS'),
    ('DV SAN MANUEL'),
    ('DV VARILLAS'),
    ('DV LOS LLANOS'),
    ('DV BARRANCAS'),
    ('DV LA CAÑA')
) as datos(nombre)
where not exists (
  select 1 from public.sectores s where s.nombre = datos.nombre
);

notify pgrst, 'reload schema';
