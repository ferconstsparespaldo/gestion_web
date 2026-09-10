-- ============================================================
-- Fecha de factura por cotización
-- Ejecutar DESPUÉS de:
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
--   202609080001_eliminacion_admin.sql
--   202609080002_gastos_tipo_socio.sql
-- ============================================================

-- El SII reconoce el IVA débito según el mes en que se emite la factura,
-- que puede no coincidir con el mes en que se aceptó la cotización.
-- Es un campo manual: se completa cuando el documento tributario ya fue
-- emitido, y puede quedar vacío mientras tanto.
alter table public.cotizaciones
  add column if not exists fecha_factura date;

create index if not exists cotizaciones_fecha_factura_idx
  on public.cotizaciones (fecha_factura);

notify pgrst, 'reload schema';
