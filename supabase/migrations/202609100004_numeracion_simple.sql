-- ============================================================
-- Numeración de cotizaciones: correlativo simple y continuo
-- Ejecutar DESPUÉS de:
--   202609060000_esquema_base.sql
--   202609070001_integridad_operacional.sql
-- ============================================================

-- Ferconst ya numeraba sus cotizaciones en Excel con un correlativo plano
-- y continuo (1, 2, 3... 202), sin prefijo ni año. Se reemplaza el
-- formato "PREFIJO-AÑO-0001" de la plantilla genérica por un número
-- simple, y se siembra el correlativo para continuar exactamente donde
-- quedó el Excel: la próxima cotización nueva será la N° 203.
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
  v_maximo_existente integer;
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

  -- p_prefijo/p_anio se mantienen en la firma por compatibilidad con el
  -- frontend existente, pero ya no se usan para componer el número.
  perform pg_advisory_xact_lock(hashtext('cotizacion:correlativo_global'));

  select coalesce(max(numero::integer), 0)
    into v_maximo_existente
  from public.cotizaciones
  where numero ~ '^[0-9]+$';

  insert into public.cotizacion_correlativos as cc(prefijo, anio, ultimo)
  values ('GLOBAL', 0, v_maximo_existente + 1)
  on conflict (prefijo, anio)
  do update
    set ultimo = greatest(cc.ultimo + 1, v_maximo_existente + 1)
  returning ultimo into v_siguiente;

  return v_siguiente::text;
end;
$$;

revoke all on function public.reservar_numero_cotizacion(text, integer) from public;
grant execute on function public.reservar_numero_cotizacion(text, integer) to authenticated;

-- Siembra: la cotización N° 202 ya existe en el Excel de Ferconst (fuera
-- de este sistema), así que el correlativo arranca ahí y la próxima
-- cotización generada por la app será la 203.
insert into public.cotizacion_correlativos (prefijo, anio, ultimo)
values ('GLOBAL', 0, 202)
on conflict (prefijo, anio)
do update set ultimo = greatest(public.cotizacion_correlativos.ultimo, 202);

notify pgrst, 'reload schema';
