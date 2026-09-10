-- ============================================================
-- BORRADO ÚNICO DE DATOS DE PRUEBA
-- ============================================================
-- ADVERTENCIA: este script elimina TODOS los datos comerciales/financieros
-- actuales. Úsalo solo porque la base contiene datos ficticios de prueba.
--
-- SE CONSERVAN:
--   - auth.users
--   - public.profiles
--   - public.configuracion_empresa
--   - buckets/archivos de Storage
-- ============================================================

begin;

-- Finanzas y transacciones dependientes.
delete from public.pagos_clientes;
delete from public.pagos_proveedores;
delete from public.cotizacion_items;
delete from public.cotizaciones;
delete from public.gastos;
delete from public.impuestos_mensuales;

-- Catálogo e historial.
delete from public.historial_precios;
delete from public.producto_proveedor;
delete from public.productos;
delete from public.clientes;
delete from public.proveedores;
delete from public.categorias_gasto;

-- Si ya se aplicó la migración de correlativos, reinicia el contador para que
-- la primera cotización real vuelva a comenzar en 0001.
do $$
begin
  if to_regclass('public.cotizacion_correlativos') is not null then
    execute 'delete from public.cotizacion_correlativos';
  end if;
end
$$;

commit;

-- Verificación: todos estos conteos deberían quedar en 0.
select 'clientes' as tabla, count(*) as filas from public.clientes
union all select 'proveedores', count(*) from public.proveedores
union all select 'productos', count(*) from public.productos
union all select 'cotizaciones', count(*) from public.cotizaciones
union all select 'pagos_clientes', count(*) from public.pagos_clientes
union all select 'pagos_proveedores', count(*) from public.pagos_proveedores
union all select 'gastos', count(*) from public.gastos
union all select 'impuestos_mensuales', count(*) from public.impuestos_mensuales;
