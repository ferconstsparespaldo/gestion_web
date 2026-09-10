-- ============================================================
-- Capital de socios
-- Ejecutar DESPUÉS de:
--   202609070001_integridad_operacional.sql
--   202609070002_seguridad_rls.sql
--   202609080001_eliminacion_admin.sql
--   202609080002_gastos_tipo_socio.sql
--   202609090001_cotizaciones_fecha_factura.sql
--   202609090002_gastos_fecha_pago.sql
-- ============================================================

-- Registro de aportes y retiros de capital de los socios que financian
-- la empresa. Es información exclusiva de administración: no se mezcla
-- con Pagos (que registra cobros/pagos operacionales del negocio).
create table if not exists public.capital_movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  socio text not null,
  tipo text not null,
  monto numeric not null,
  metodo_pago text,
  referencia text,
  observaciones text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.capital_movimientos
  drop constraint if exists capital_movimientos_tipo_check;

alter table public.capital_movimientos
  add constraint capital_movimientos_tipo_check check (tipo in ('Aporte', 'Retiro'));

alter table public.capital_movimientos
  drop constraint if exists capital_movimientos_monto_check;

alter table public.capital_movimientos
  add constraint capital_movimientos_monto_check check (monto > 0);

create index if not exists capital_movimientos_fecha_idx
  on public.capital_movimientos (fecha);

-- Exclusivo de administradores: ni siquiera lectura para trabajadores.
alter table public.capital_movimientos enable row level security;

drop policy if exists "lu_capital_movimientos_admin" on public.capital_movimientos;
create policy "lu_capital_movimientos_admin"
on public.capital_movimientos for all to authenticated
using (public.usuario_admin())
with check (public.usuario_admin());

notify pgrst, 'reload schema';
