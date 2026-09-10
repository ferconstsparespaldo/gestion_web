-- ============================================================
-- Eliminación administrada
-- Ejecutar DESPUÉS de:
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
-- ============================================================

-- Refuerzo: aunque un trabajador pueda editar datos comerciales mediante RLS,
-- no puede desactivar ni eliminar registros sensibles directamente por API.
create or replace function public.exigir_admin_operacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_admin() then
    raise exception 'Esta operación está disponible solo para administradores.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.exigir_admin_operacion() from public;

-- Solo admin puede cambiar el estado activo de clientes/productos.
drop trigger if exists trg_clientes_activo_solo_admin on public.clientes;
create trigger trg_clientes_activo_solo_admin
before update of activo on public.clientes
for each row
when (old.activo is distinct from new.activo)
execute function public.exigir_admin_operacion();

drop trigger if exists trg_productos_activo_solo_admin on public.productos;
create trigger trg_productos_activo_solo_admin
before update of activo on public.productos
for each row
when (old.activo is distinct from new.activo)
execute function public.exigir_admin_operacion();

-- Si alguien intenta borrar directamente por la API, también debe ser admin.
drop trigger if exists trg_clientes_delete_solo_admin on public.clientes;
create trigger trg_clientes_delete_solo_admin
before delete on public.clientes
for each row
execute function public.exigir_admin_operacion();

drop trigger if exists trg_productos_delete_solo_admin on public.productos;
create trigger trg_productos_delete_solo_admin
before delete on public.productos
for each row
execute function public.exigir_admin_operacion();

drop trigger if exists trg_cotizaciones_delete_solo_admin on public.cotizaciones;
create trigger trg_cotizaciones_delete_solo_admin
before delete on public.cotizaciones
for each row
execute function public.exigir_admin_operacion();

-- ------------------------------------------------------------
-- Clientes: eliminación segura = desactivación.
-- Mantiene las cotizaciones históricas y evita romper FKs.
-- ------------------------------------------------------------
create or replace function public.desactivar_cliente_admin(
  p_cliente_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_admin() then
    raise exception 'Solo un administrador puede eliminar clientes.';
  end if;

  update public.clientes
  set activo = false,
      updated_at = now()
  where id = p_cliente_id;

  if not found then
    raise exception 'No se encontró el cliente.';
  end if;
end;
$$;

revoke all on function public.desactivar_cliente_admin(uuid) from public;
grant execute on function public.desactivar_cliente_admin(uuid) to authenticated;

-- ------------------------------------------------------------
-- Productos: eliminación segura = desactivación.
-- Las cotizaciones históricas conservan nombre, precios e imagen ya guardados.
-- ------------------------------------------------------------
create or replace function public.desactivar_producto_admin(
  p_producto_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_admin() then
    raise exception 'Solo un administrador puede eliminar productos.';
  end if;

  update public.productos
  set activo = false,
      updated_at = now()
  where id = p_producto_id;

  if not found then
    raise exception 'No se encontró el producto.';
  end if;
end;
$$;

revoke all on function public.desactivar_producto_admin(uuid) from public;
grant execute on function public.desactivar_producto_admin(uuid) to authenticated;

-- ------------------------------------------------------------
-- Cotizaciones: eliminación permanente y transaccional.
-- Se eliminan primero los registros dependientes para respetar las FKs.
-- ------------------------------------------------------------
create or replace function public.eliminar_cotizacion_admin(
  p_cotizacion_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.usuario_admin() then
    raise exception 'Solo un administrador puede eliminar cotizaciones.';
  end if;

  if not exists (
    select 1
    from public.cotizaciones
    where id = p_cotizacion_id
  ) then
    raise exception 'No se encontró la cotización.';
  end if;

  -- Pagos vinculados se eliminan junto con la cotización. La UI muestra
  -- una advertencia explícita antes de confirmar esta operación.
  delete from public.pagos_clientes
  where cotizacion_id = p_cotizacion_id;

  delete from public.pagos_proveedores
  where cotizacion_id = p_cotizacion_id;

  delete from public.cotizacion_items
  where cotizacion_id = p_cotizacion_id;

  delete from public.cotizaciones
  where id = p_cotizacion_id;
end;
$$;

revoke all on function public.eliminar_cotizacion_admin(uuid) from public;
grant execute on function public.eliminar_cotizacion_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
