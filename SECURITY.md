# Seguridad y revisión Supabase

## Qué está cubierto por este repositorio

- `.env` y variantes quedan excluidos de Git.
- El frontend solo usa la anon key de Supabase.
- La administración de usuarios se realiza mediante una Edge Function que valida rol admin del solicitante.
- Se incluyen políticas RLS para separar módulos comerciales y financieros.
- Se incluyen validaciones de base de datos contra sobrepagos.
- El correlativo de cotizaciones se reserva en PostgreSQL y el número queda protegido por índice UNIQUE.

## Verificación obligatoria de políticas antiguas

Las migraciones incluidas **no eliminan políticas RLS preexistentes que tengan nombres distintos**. PostgreSQL combina políticas permisivas con OR, por lo que una política antigua demasiado abierta podría seguir dando acceso.

Antes de producción revisa las políticas existentes desde Supabase Dashboard o ejecuta:

```sql
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

Revisa especialmente:

- `profiles`
- `clientes`
- `proveedores`
- `productos`
- `producto_proveedor`
- `cotizaciones`
- `cotizacion_items`
- `pagos_clientes`
- `pagos_proveedores`
- `gastos`
- `categorias_gasto`
- `impuestos_mensuales`
- `configuracion_empresa`
- `storage.objects`

## Roles esperados

- `admin`: acceso comercial, catálogo, finanzas, impuestos y configuración.
- `trabajador`: acceso comercial y catálogo, sin acceso a finanzas ni configuración administrativa.
- Usuario con `activo = false`: sin acceso funcional.

## Storage

La aplicación espera, por defecto (nombre configurable vía
`VITE_STORAGE_BUCKET_ASSETS`, ver `.env.example`):

- bucket `assets` con el logo `Logo/Logo.png`.

Si estos buckets son públicos, las URLs pueden leerse sin autenticación. Si contienen información que no deba ser pública, conviértelos a privados y adapta el frontend para usar signed URLs.

## Edge Function

`admin-users` necesita `SUPABASE_SERVICE_ROLE_KEY` solo en el entorno seguro de Supabase Functions. Esa clave no debe aparecer en GitHub, Vercel, el bundle del navegador ni variables `VITE_*`.
