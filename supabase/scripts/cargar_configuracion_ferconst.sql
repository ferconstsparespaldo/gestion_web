-- ============================================================
-- Datos iniciales de la empresa (Ferconst SpA)
-- Ejecutar UNA VEZ, después de todas las migraciones de supabase/migrations/,
-- desde el SQL Editor de Supabase.
--
-- Origen de los datos: Cotización_Ferconst_SpA.xlsm.
--
-- Solo inserta la fila si configuracion_empresa está vacía: si ya
-- completaste estos datos a mano desde Configuración > Empresa, este
-- script no los sobrescribe.
-- ============================================================

insert into public.configuracion_empresa (
  razon_social,
  rut,
  correo,
  telefono
)
select
  'Ferconst SpA',
  '77.102.709-1',
  'ferconstspa@gmail.com',
  '+56 9 9736 6609'
where not exists (
  select 1 from public.configuracion_empresa
);
