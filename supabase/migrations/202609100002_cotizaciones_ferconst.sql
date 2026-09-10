-- ============================================================
-- Cotizaciones: sector, N° de orden, días trabajados y mano de obra
-- Ejecutar DESPUÉS de:
--   202609060000_esquema_base.sql
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
--   202609080001_eliminacion_admin.sql
--   202609100001_sectores.sql
-- ============================================================

-- 1) Cabecera de la cotización: sector donde se hizo el trabajo y N° de
--    orden de compra del cliente (campos que ya trae el formato real de
--    cotización de Ferconst y que la plantilla genérica no tenía).
alter table public.cotizaciones
  add column if not exists sector_id uuid references public.sectores(id) on delete set null,
  add column if not exists sector_nombre text,
  add column if not exists numero_orden text;

create index if not exists cotizaciones_sector_idx
  on public.cotizaciones (sector_id);

-- 2) Los trabajos pueden extenderse por más de un día. fecha_trabajo_inicio
--    es obligatoria en la práctica (se completa desde el formulario) y
--    fecha_trabajo_termino queda vacía cuando el trabajo se hizo en un
--    solo día.
alter table public.cotizaciones
  add column if not exists fecha_trabajo_inicio date,
  add column if not exists fecha_trabajo_termino date;

-- 3) Mano de obra: horario, N° de trabajadores y valor hora, con el costo
--    ya calculado (horas x trabajadores x valor hora), igual al cálculo
--    que Ferconst ya usaba en su hoja de cálculo de materiales.
alter table public.cotizaciones
  add column if not exists hora_desde time,
  add column if not exists hora_hasta time,
  add column if not exists horas_trabajadas numeric not null default 0,
  add column if not exists num_trabajadores integer not null default 0,
  add column if not exists valor_hora numeric not null default 0,
  add column if not exists costo_hh numeric not null default 0;

-- 4) Costo de traslado: ya existía como "despacho_neto" (mismo concepto,
--    solo cambia la etiqueta que ve el usuario). No se duplica la columna.

-- 5) Parámetros por defecto para el bloque de mano de obra, configurables
--    una sola vez en Configuración > Parámetros.
alter table public.configuracion_empresa
  add column if not exists valor_hora_defecto numeric not null default 0,
  add column if not exists num_trabajadores_defecto integer not null default 1;

-- 6) Reemplaza el guardado transaccional de cotización + ítems para que
--    también persista los campos nuevos.
create or replace function public.guardar_cotizacion_transaccional(
  p_cotizacion_id uuid,
  p_datos jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para guardar cotizaciones.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La cotización debe contener al menos un producto.';
  end if;

  if coalesce(nullif(trim(p_datos->>'numero'), ''), '') = '' then
    raise exception 'La cotización debe tener un número.';
  end if;

  if p_cotizacion_id is null then
    insert into public.cotizaciones (
      numero,
      fecha,
      estado,
      cliente_id,
      cliente_razon_social,
      cliente_rut,
      cliente_direccion,
      cliente_contacto,
      cliente_telefono,
      cliente_correo,
      sector_id,
      sector_nombre,
      numero_orden,
      fecha_trabajo_inicio,
      fecha_trabajo_termino,
      hora_desde,
      hora_hasta,
      horas_trabajadas,
      num_trabajadores,
      valor_hora,
      costo_hh,
      subtotal_productos_neto,
      despacho_neto,
      descuento_neto,
      neto_total,
      iva,
      total_final,
      vigencia_dias,
      observaciones,
      pdf_generado,
      created_by
    ) values (
      p_datos->>'numero',
      (p_datos->>'fecha')::date,
      p_datos->>'estado',
      nullif(p_datos->>'cliente_id', '')::uuid,
      p_datos->>'cliente_razon_social',
      nullif(p_datos->>'cliente_rut', ''),
      nullif(p_datos->>'cliente_direccion', ''),
      nullif(p_datos->>'cliente_contacto', ''),
      nullif(p_datos->>'cliente_telefono', ''),
      nullif(p_datos->>'cliente_correo', ''),
      nullif(p_datos->>'sector_id', '')::uuid,
      nullif(p_datos->>'sector_nombre', ''),
      nullif(p_datos->>'numero_orden', ''),
      nullif(p_datos->>'fecha_trabajo_inicio', '')::date,
      nullif(p_datos->>'fecha_trabajo_termino', '')::date,
      nullif(p_datos->>'hora_desde', '')::time,
      nullif(p_datos->>'hora_hasta', '')::time,
      coalesce((p_datos->>'horas_trabajadas')::numeric, 0),
      coalesce((p_datos->>'num_trabajadores')::integer, 0),
      coalesce((p_datos->>'valor_hora')::numeric, 0),
      coalesce((p_datos->>'costo_hh')::numeric, 0),
      coalesce((p_datos->>'subtotal_productos_neto')::numeric, 0),
      coalesce((p_datos->>'despacho_neto')::numeric, 0),
      coalesce((p_datos->>'descuento_neto')::numeric, 0),
      coalesce((p_datos->>'neto_total')::numeric, 0),
      coalesce((p_datos->>'iva')::numeric, 0),
      coalesce((p_datos->>'total_final')::numeric, 0),
      coalesce((p_datos->>'vigencia_dias')::integer, 15),
      nullif(p_datos->>'observaciones', ''),
      coalesce((p_datos->>'pdf_generado')::boolean, false),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.cotizaciones
    set
      numero = p_datos->>'numero',
      fecha = (p_datos->>'fecha')::date,
      estado = p_datos->>'estado',
      cliente_id = nullif(p_datos->>'cliente_id', '')::uuid,
      cliente_razon_social = p_datos->>'cliente_razon_social',
      cliente_rut = nullif(p_datos->>'cliente_rut', ''),
      cliente_direccion = nullif(p_datos->>'cliente_direccion', ''),
      cliente_contacto = nullif(p_datos->>'cliente_contacto', ''),
      cliente_telefono = nullif(p_datos->>'cliente_telefono', ''),
      cliente_correo = nullif(p_datos->>'cliente_correo', ''),
      sector_id = nullif(p_datos->>'sector_id', '')::uuid,
      sector_nombre = nullif(p_datos->>'sector_nombre', ''),
      numero_orden = nullif(p_datos->>'numero_orden', ''),
      fecha_trabajo_inicio = nullif(p_datos->>'fecha_trabajo_inicio', '')::date,
      fecha_trabajo_termino = nullif(p_datos->>'fecha_trabajo_termino', '')::date,
      hora_desde = nullif(p_datos->>'hora_desde', '')::time,
      hora_hasta = nullif(p_datos->>'hora_hasta', '')::time,
      horas_trabajadas = coalesce((p_datos->>'horas_trabajadas')::numeric, 0),
      num_trabajadores = coalesce((p_datos->>'num_trabajadores')::integer, 0),
      valor_hora = coalesce((p_datos->>'valor_hora')::numeric, 0),
      costo_hh = coalesce((p_datos->>'costo_hh')::numeric, 0),
      subtotal_productos_neto = coalesce((p_datos->>'subtotal_productos_neto')::numeric, 0),
      despacho_neto = coalesce((p_datos->>'despacho_neto')::numeric, 0),
      descuento_neto = coalesce((p_datos->>'descuento_neto')::numeric, 0),
      neto_total = coalesce((p_datos->>'neto_total')::numeric, 0),
      iva = coalesce((p_datos->>'iva')::numeric, 0),
      total_final = coalesce((p_datos->>'total_final')::numeric, 0),
      vigencia_dias = coalesce((p_datos->>'vigencia_dias')::integer, 15),
      observaciones = nullif(p_datos->>'observaciones', ''),
      pdf_generado = coalesce((p_datos->>'pdf_generado')::boolean, false)
    where id = p_cotizacion_id
    returning id into v_id;

    if v_id is null then
      raise exception 'No se encontró la cotización a actualizar.';
    end if;

    delete from public.cotizacion_items
    where cotizacion_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(nullif(v_item->>'producto_id', ''), '') = '' then
      raise exception 'Todos los ítems deben tener producto.';
    end if;

    if coalesce((v_item->>'cantidad')::numeric, 0) <= 0 then
      raise exception 'La cantidad debe ser mayor a cero.';
    end if;

    insert into public.cotizacion_items (
      cotizacion_id,
      producto_id,
      proveedor_id,
      nombre_producto,
      descripcion,
      imagen_url,
      cantidad,
      precio_neto_proveedor,
      beneficio_unitario,
      precio_neto_venta,
      costo_total,
      beneficio_total,
      total_neto_linea
    ) values (
      v_id,
      (v_item->>'producto_id')::uuid,
      nullif(v_item->>'proveedor_id', '')::uuid,
      v_item->>'nombre_producto',
      nullif(v_item->>'descripcion', ''),
      nullif(v_item->>'imagen_url', ''),
      (v_item->>'cantidad')::numeric,
      coalesce((v_item->>'precio_neto_proveedor')::numeric, 0),
      coalesce((v_item->>'beneficio_unitario')::numeric, 0),
      coalesce((v_item->>'precio_neto_venta')::numeric, 0),
      coalesce((v_item->>'costo_total')::numeric, 0),
      coalesce((v_item->>'beneficio_total')::numeric, 0),
      coalesce((v_item->>'total_neto_linea')::numeric, 0)
    );
  end loop;

  return v_id;
end;
$$;

revoke all on function public.guardar_cotizacion_transaccional(uuid, jsonb, jsonb) from public;
grant execute on function public.guardar_cotizacion_transaccional(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
