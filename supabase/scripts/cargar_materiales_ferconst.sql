-- ============================================================
-- Carga inicial de materiales de Ferconst SpA
-- Ejecutar UNA VEZ, después de todas las migraciones de supabase/migrations/,
-- desde el SQL Editor de Supabase (o `supabase db execute`).
--
-- Origen de los datos: hoja "Datos" de Cotización_Ferconst_SpA.xlsm.
-- El Excel solo registra el precio con el que Ferconst cobra cada
-- material (sin desglosar costo/ganancia), así que se carga como
-- precio_neto_actual con beneficio_sugerido = 0. Edita cada producto
-- desde Productos para dejar el costo real y la ganancia por pieza.
--
-- Es seguro volver a ejecutar este script: no duplica productos que ya
-- existan por nombre, y completa la relación de precio para productos que
-- ya existan pero todavía no tengan uno.
-- ============================================================

with datos(nombre, precio) as (
  values
    ('Sacos', 500),
    ('Malla acma', 18500),
    ('Malla Biscocho del 1,80 x 25 [cm]', 75000),
    ('Fierro liso del 10', 9000),
    ('Unión americana de 20', 1300),
    ('Unión americana de 25', 1500),
    ('Unión americana 32', 3000),
    ('Unión americana 40', 5000),
    ('Contra peso cortina', 15000),
    ('llave de paso de 20, bronce', 2500),
    ('llave de paso de 25, bronce', 4100),
    ('llave de paso de 32,bronce', 10000),
    ('llave de paso de 40, bronce', 15000),
    ('Válvula essety 150 [m]', 25000),
    ('Bolla de 150 [m]', 12000),
    ('Teflón', 1000),
    ('Un poco de Vinilit', 2000),
    ('Vinilit', 6000),
    ('Codo pvc de 20', 400),
    ('Codo pvc de 25', 450),
    ('Codo pvc de 32', 700),
    ('Codo pvc de 40', 900),
    ('Codo pvc de 50', 1500),
    ('Codo pvc de 63', 2600),
    ('Codo HI 32', 2000),
    ('Copla pvc de 20', 400),
    ('Copla pvc de 25', 460),
    ('Copla pvc de 32', 600),
    ('Copla pvc de 40', 800),
    ('Copla pvc de 50', 1500),
    ('Copla pvc de 63', 1700),
    ('Copla PVC de 200', 42000),
    ('Copla pvc de 110', 9500),
    ('Terminal HE 20', 400),
    ('Terminal HE 25', 450),
    ('Terminal HE 32', 500),
    ('Terminal HE 40', 750),
    ('Terminal HE 50', 1100),
    ('Terminal HE 63', 2700),
    ('Terminal HI 20', 500),
    ('Terminal HI 25', 550),
    ('Terminal HI 32', 700),
    ('Terminal HI 40', 1400),
    ('Terminal HI 50', 1600),
    ('Terminal HI 63', 2700),
    ('T pvc de 20', 400),
    ('T pvc de 25', 500),
    ('T pvc de 32', 900),
    ('T pvc de 40', 1500),
    ('T pvc de 50', 1550),
    ('T pvc de 63', 3600),
    ('Silicona', 4000),
    ('Lija', 1000),
    ('Lubricante W40', 6000),
    ('Camara de motos', 12000),
    ('Prensa crosbi', 500),
    ('Tapa gorro 200 [m]', 18000),
    ('PVC agricola 200 [cm]', 30000),
    ('Salida estanque 32', 2500),
    ('salida estanque 40 mm', 3200),
    ('salida estanque 50 mm', 5500),
    ('Perno anclaje', 2000),
    ('Buje 75 a 63', 2300),
    ('Buje 63 a 50', 1500),
    ('Buje 50 a 40', 750),
    ('Buje 40 a 32', 550),
    ('Buje 32 a 25', 500),
    ('Buje 25 a 20', 350),
    ('Canal U de 3mm', 18000),
    ('Canal U de 2mm', 15000),
    ('Cemento', 4500),
    ('Poliuretano', 9000),
    ('Disco de lija de traslape', 2000),
    ('Disco de corte', 1000),
    ('Clavos del 4', 2000),
    ('Grapas 1 1/4', 2000),
    ('Pernos cabeza lenteja', 2000),
    ('Alambre pua 1[kg]', 24000),
    ('Fierro liso del 12', 10000),
    ('Válvula de presión bronce', 42000),
    ('Tirafondos del 5/16 x 4', 700),
    ('soldadura 6011/332, 1k', 8000),
    ('soldadura 6011/332, 1/2 k', 4000),
    ('Electrodo 19-9 acero inoxidable', 3000),
    ('angulo laminado 30x30', 4000),
    ('Ruedas giratorias con freno TPE 150K', 15000),
    ('spray anticorrosivo color gris', 8500),
    ('Tubo de fierro galvanizado de 90x600 en 3mm', 90000),
    ('Reducción de 40 a 32', 500),
    ('Reducción de 32 a 25', 350),
    ('Reducción de 25 a 20', 350),
    ('Tornillos de 1 5/8', 3200),
    ('Clavos del 2 1/2', 2500),
    ('PVC', 2000),
    ('Soga 1 metro', 1000),
    ('Tubo galvanizado de 20mm con hilo HEHE "Baston"', 11000),
    ('Codo HI-HI de 20', 1000),
    ('1mts de manguera 2 1/2 corrugado amarilla', 9000),
    ('1mts de manguera amarilla para gas', 600),
    ('1 tubo clase 6 de 110 PVC hidraulico', 32000),
    ('Terminal HE de 110', 12000),
    ('Tapa Hi de 110', 13000),
    ('1metro de cadena eslabon corto', 1200),
    ('fabricación de S para regular cadena', 200),
    ('unión cola de bronce', 1300),
    ('PVC de 20 de 6metros', 3000),
    ('Tapa gorro HI de 20mm', 420),
    ('1internil de 3mm', 7000),
    ('1 Espuma expansiva de poliuretan', 7000),
    ('Tornillo punta broca de 1', 2000),
    ('1 Tirafondo', 1000),
    ('Perno con Hilo para sujetar escuadra a la viga', 3000),
    ('Cancamo de inlet', 4000),
    ('cancamo', 700),
    ('Codo HI metalico de bronce', 3000),
    ('Viga de 2x5 impregnada', 11000),
    ('Hilo corrido esparrago de 1pulgada', 4000),
    ('tuercas de 1 pulgada', 500)
),
nuevos as (
  insert into public.productos (nombre)
  select d.nombre
  from datos d
  where not exists (
    select 1 from public.productos p where p.nombre = d.nombre
  )
  returning id, nombre
)
insert into public.producto_proveedor (producto_id, precio_neto_actual, beneficio_sugerido)
select n.id, d.precio, 0
from nuevos n
join datos d on d.nombre = n.nombre;
