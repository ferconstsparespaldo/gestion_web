-- ============================================================
-- Integridad operacional
-- Requiere las tablas existentes del proyecto.
-- Ejecutar primero en staging / copia de la base.
-- ============================================================

-- 1) Las cotizaciones aceptadas históricas que no tengan fecha de aceptación
--    se consideran aceptadas en su fecha de emisión para no perderlas de los KPIs.
update public.cotizaciones
set fecha_aceptacion = fecha
where estado = 'Aceptada'
  and fecha_aceptacion is null;

create index if not exists cotizaciones_fecha_aceptacion_idx
  on public.cotizaciones (fecha_aceptacion);

-- 2) El número de cotización debe ser único.
do $$
begin
  if exists (
    select 1
    from public.cotizaciones
    group by numero
    having count(*) > 1
  ) then
    raise exception 'Existen números de cotización duplicados. Corrígelos antes de aplicar el índice UNIQUE.';
  end if;
end
$$;

create unique index if not exists cotizaciones_numero_unique
  on public.cotizaciones (numero);

-- 3) Correlativos seguros. Reservar un número puede dejar saltos si el usuario
--    cancela la cotización; es intencional para evitar duplicados concurrentes.
create table if not exists public.cotizacion_correlativos (
  prefijo text not null,
  anio integer not null,
  ultimo integer not null default 0 check (ultimo >= 0),
  primary key (prefijo, anio)
);

alter table public.cotizacion_correlativos enable row level security;

create or replace function public.reservar_numero_cotizacion(
  p_prefijo text,
  p_anio integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
  v_actual_existente integer;
  v_siguiente integer;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para generar una cotización.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and activo = true
  ) then
    raise exception 'El usuario no está activo.';
  end if;

  v_prefijo := regexp_replace(upper(coalesce(nullif(trim(p_prefijo), ''), 'COT')), '[^A-Z0-9_-]', '', 'g');
  if v_prefijo = '' then
    v_prefijo := 'COT';
  end if;

  if p_anio < 2000 or p_anio > 2200 then
    raise exception 'Año de cotización inválido.';
  end if;

  -- Lock por prefijo/año para serializar reservas concurrentes.
  perform pg_advisory_xact_lock(hashtext('cotizacion:' || v_prefijo || ':' || p_anio::text));

  select coalesce(max((substring(numero from '([0-9]+)$'))::integer), 0)
    into v_actual_existente
  from public.cotizaciones
  where numero like v_prefijo || '-' || p_anio::text || '-%'
    and numero ~ '[0-9]+$';

  insert into public.cotizacion_correlativos as cc(prefijo, anio, ultimo)
  values (v_prefijo, p_anio, v_actual_existente + 1)
  on conflict (prefijo, anio)
  do update
    set ultimo = greatest(cc.ultimo + 1, excluded.ultimo)
  returning ultimo into v_siguiente;

  return format(
    '%s-%s-%s',
    v_prefijo,
    p_anio,
    case
      when v_siguiente < 10000 then lpad(v_siguiente::text, 4, '0')
      else v_siguiente::text
    end
  );
end;
$$;

revoke all on function public.reservar_numero_cotizacion(text, integer) from public;
grant execute on function public.reservar_numero_cotizacion(text, integer) to authenticated;

-- 4) Guardado transaccional de cotización + ítems.
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

-- 5) Guardado transaccional de producto + relación con proveedor.
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

  if coalesce(nullif(p_relacion->>'proveedor_id', ''), '') = '' then
    raise exception 'Debes indicar un proveedor.';
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
      (p_relacion->>'proveedor_id')::uuid,
      coalesce((p_relacion->>'precio_neto_actual')::numeric, 0),
      coalesce((p_relacion->>'beneficio_sugerido')::numeric, 0)
    );
  else
    update public.producto_proveedor
    set
      producto_id = v_producto_id,
      proveedor_id = (p_relacion->>'proveedor_id')::uuid,
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

-- 6) Barreras de base de datos contra sobrepagos.
create or replace function public.validar_pago_cliente_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_pagado numeric;
begin
  if new.monto is null or new.monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  select total_final
    into v_total
  from public.cotizaciones
  where id = new.cotizacion_id
    and estado = 'Aceptada';

  if v_total is null then
    raise exception 'La cotización no existe o no está aceptada.';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(monto), 0)
      into v_pagado
    from public.pagos_clientes
    where cotizacion_id = new.cotizacion_id
      and id <> old.id;
  else
    select coalesce(sum(monto), 0)
      into v_pagado
    from public.pagos_clientes
    where cotizacion_id = new.cotizacion_id;
  end if;

  if v_pagado + new.monto > v_total + 0.5 then
    raise exception 'El pago supera el saldo pendiente de la cotización.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_pago_cliente_saldo on public.pagos_clientes;
create trigger trg_validar_pago_cliente_saldo
before insert or update on public.pagos_clientes
for each row execute function public.validar_pago_cliente_saldo();

create or replace function public.validar_pago_proveedor_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_costo numeric;
  v_pagado numeric;
begin
  if new.monto is null or new.monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  if new.proveedor_id is null then
    raise exception 'El pago debe tener proveedor.';
  end if;

  -- Si el egreso no se relaciona a una cotización, se permite como movimiento manual.
  if new.cotizacion_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.cotizaciones
    where id = new.cotizacion_id and estado = 'Aceptada'
  ) then
    raise exception 'La cotización relacionada no existe o no está aceptada.';
  end if;

  select coalesce(sum(costo_total), 0)
    into v_costo
  from public.cotizacion_items
  where cotizacion_id = new.cotizacion_id
    and proveedor_id = new.proveedor_id;

  if v_costo <= 0 then
    raise exception 'No existe saldo de productos para este proveedor en la cotización.';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(monto), 0)
      into v_pagado
    from public.pagos_proveedores
    where cotizacion_id = new.cotizacion_id
      and proveedor_id = new.proveedor_id
      and id <> old.id;
  else
    select coalesce(sum(monto), 0)
      into v_pagado
    from public.pagos_proveedores
    where cotizacion_id = new.cotizacion_id
      and proveedor_id = new.proveedor_id;
  end if;

  if v_pagado + new.monto > v_costo + 0.5 then
    raise exception 'El pago supera el saldo pendiente con el proveedor.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_pago_proveedor_saldo on public.pagos_proveedores;
create trigger trg_validar_pago_proveedor_saldo
before insert or update on public.pagos_proveedores
for each row execute function public.validar_pago_proveedor_saldo();
