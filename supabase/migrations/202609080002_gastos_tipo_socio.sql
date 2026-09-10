-- ============================================================
-- Gastos: compras de socio (solo crédito IVA)
-- Ejecutar DESPUÉS de:
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
--   202609080001_eliminacion_admin.sql
-- ============================================================

-- Distingue gastos operacionales de la empresa de compras que un socio
-- paga con su propio dinero, donde la empresa solo aprovecha el crédito
-- de IVA del documento (no es un egreso real de la empresa).
alter table public.gastos
  add column if not exists tipo text not null default 'Operacional';

alter table public.gastos
  drop constraint if exists gastos_tipo_check;

alter table public.gastos
  add constraint gastos_tipo_check check (tipo in ('Operacional', 'Socio'));

notify pgrst, 'reload schema';
