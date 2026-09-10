-- ============================================================
-- Correcciones a Proveedores
-- Ejecutar DESPUÉS de:
--   202609060000_esquema_base.sql
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
--   202609080001_eliminacion_admin.sql
-- ============================================================

-- El frontend (src/components/Proveedores.tsx) ya invocaba
-- desactivar_proveedor_admin, pero esa función nunca quedó documentada
-- como migración: se creó a mano en el proyecto original. Se agrega aquí
-- junto con los mismos resguardos que ya existen para clientes/productos,
-- para que un trabajador no pueda desactivar/eliminar proveedores
-- directamente por la API saltándose el rol de administrador.

drop trigger if exists trg_proveedores_activo_solo_admin on public.proveedores;
create trigger trg_proveedores_activo_solo_admin
before update of activo on public.proveedores
for each row
when (old.activo is distinct from new.activo)
execute function public.exigir_admin_operacion();

drop trigger if exists trg_proveedores_delete_solo_admin on public.proveedores;
create trigger trg_proveedores_delete_solo_admin
before delete on public.proveedores
for each row
execute function public.exigir_admin_operacion();

create or replace function public.desactivar_proveedor_admin(
  p_proveedor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_admin() then
    raise exception 'Solo un administrador puede eliminar proveedores.';
  end if;

  update public.proveedores
  set activo = false,
      updated_at = now()
  where id = p_proveedor_id;

  if not found then
    raise exception 'No se encontró el proveedor.';
  end if;
end;
$$;

revoke all on function public.desactivar_proveedor_admin(uuid) from public;
grant execute on function public.desactivar_proveedor_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
