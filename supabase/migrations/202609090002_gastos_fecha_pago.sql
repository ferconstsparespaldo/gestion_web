-- ============================================================
-- Fecha de pago real de los gastos
-- Ejecutar DESPUÉS de:
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
--   202609080001_eliminacion_admin.sql
--   202609080002_gastos_tipo_socio.sql
--   202609090001_cotizaciones_fecha_factura.sql
-- ============================================================

-- `fecha` en gastos es la fecha del documento (emisión/registro), pero el
-- pago real a un proveedor puede ocurrir en un mes distinto. Se agrega una
-- fecha de pago independiente para que el flujo de caja real (Estado de
-- Resultados y Dashboard) refleje el mes en que efectivamente salió el
-- dinero, no el mes del documento.
alter table public.gastos
  add column if not exists fecha_pago date;

-- Los gastos históricos ya marcados como Pagado no tenían este campo:
-- se asume que se pagaron el mismo día del documento para no alterar
-- retroactivamente los totales ya calculados.
update public.gastos
set fecha_pago = fecha
where estado_pago = 'Pagado'
  and fecha_pago is null;

create index if not exists gastos_fecha_pago_idx
  on public.gastos (fecha_pago);

notify pgrst, 'reload schema';
