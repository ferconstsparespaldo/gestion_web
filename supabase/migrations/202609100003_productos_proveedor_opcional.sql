-- ============================================================
-- Productos: el proveedor pasa a ser opcional
-- Ejecutar DESPUÉS de:
--   202609060000_esquema_base.sql
--   202609070001_integridad_operacional.sql
-- ============================================================

-- Ferconst carga sus materiales con precio de costo y ganancia aproximada
-- por pieza, sin necesidad de registrar un proveedor real para cada uno
-- (ver Ferconst SpA Instrucciones.txt). producto_proveedor.proveedor_id ya
-- era nullable en el esquema base; este archivo ajusta el guardado
-- transaccional para dejar de exigirlo.
create or replace function public.guardar_producto_transaccional(
  p_producto_id uuid,
  p_relacion_id uuid,
  p_producto jsonb,
  p_relacion jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_producto_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para guardar productos.';
  end if;

  if coalesce(nullif(trim(p_producto->>'nombre'), ''), '') = '' then
    raise exception 'El producto debe tener nombre.';
  end if;

  if coalesce((p_relacion->>'precio_neto_actual')::numeric, 0) < 0
     or coalesce((p_relacion->>'beneficio_sugerido')::numeric, 0) < 0 then
    raise exception 'Los valores del producto no pueden ser negativos.';
  end if;

  if p_producto_id is null then
    insert into public.productos (nombre, descripcion, imagen_url, categoria)
    values (
      trim(p_producto->>'nombre'),
      nullif(p_producto->>'descripcion', ''),
      nullif(p_producto->>'imagen_url', ''),
      nullif(p_producto->>'categoria', '')
    )
    returning id into v_producto_id;
  else
    update public.productos
    set
      nombre = trim(p_producto->>'nombre'),
      descripcion = nullif(p_producto->>'descripcion', ''),
      imagen_url = nullif(p_producto->>'imagen_url', ''),
      categoria = nullif(p_producto->>'categoria', '')
    where id = p_producto_id
    returning id into v_producto_id;

    if v_producto_id is null then
      raise exception 'No se encontró el producto a actualizar.';
    end if;
  end if;

  if p_relacion_id is null then
    insert into public.producto_proveedor (
      producto_id,
      proveedor_id,
      precio_neto_actual,
      beneficio_sugerido
    ) values (
      v_producto_id,
      nullif(p_relacion->>'proveedor_id', '')::uuid,
      coalesce((p_relacion->>'precio_neto_actual')::numeric, 0),
      coalesce((p_relacion->>'beneficio_sugerido')::numeric, 0)
    );
  else
    update public.producto_proveedor
    set
      producto_id = v_producto_id,
      proveedor_id = nullif(p_relacion->>'proveedor_id', '')::uuid,
      precio_neto_actual = coalesce((p_relacion->>'precio_neto_actual')::numeric, 0),
      beneficio_sugerido = coalesce((p_relacion->>'beneficio_sugerido')::numeric, 0)
    where id = p_relacion_id;

    if not found then
      raise exception 'No se encontró la relación producto/proveedor a actualizar.';
    end if;
  end if;

  return v_producto_id;
end;
$$;

revoke all on function public.guardar_producto_transaccional(uuid, uuid, jsonb, jsonb) from public;
grant execute on function public.guardar_producto_transaccional(uuid, uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
