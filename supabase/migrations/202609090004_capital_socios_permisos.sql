-- ============================================================
-- Capital de socios: endurecer permisos
-- Ejecutar DESPUÉS de:
--   202609090003_capital_socios.sql
-- ============================================================

-- Al crear la tabla, Supabase otorga privilegios por defecto al rol
-- `anon`. La política RLS ya bloquea lectura/escritura de datos, pero
-- una consulta anónima igual recibía 200 con lista vacía en vez del
-- "permission denied" que sí devuelven el resto de tablas financieras
-- (gastos, cotizaciones, pagos_*). Se revoca el privilegio a nivel de
-- tabla para anon, dejando el acceso exclusivamente a `authenticated`
-- + la política RLS de administrador.
revoke all on table public.capital_movimientos from anon;

notify pgrst, 'reload schema';
