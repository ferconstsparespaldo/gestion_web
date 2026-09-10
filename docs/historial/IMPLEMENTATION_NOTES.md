# Cambios implementados en la preparación para GitHub

> Nota: este documento es un registro histórico del trabajo de empaquetado
> hecho para el cliente original (Ingeniería y Construcción La Unión SpA).
> Se conserva como referencia, pero no forma parte de la documentación de la
> plantilla genérica (ver README.md en la raíz del proyecto).

## Limpieza

- Eliminados `App_1.tsx` y `Cotizaciones_1.tsx`.
- Eliminados `index.css`, `react.svg`, `vite.svg` y `hero.png` por no estar utilizados.
- README genérico reemplazado por documentación del proyecto.
- `index.html` cambiado a español y con favicon local.
- Nombre del paquete cambiado a `la-union-gestion`.
- Node fijado a versión 22 mediante `engines` y `.nvmrc`.
- `.env` y variantes protegidos por `.gitignore`; se agregó `.env.example`.

## Frontend

- Cliente Supabase valida variables de entorno al iniciar.
- Sesión de Supabase tipada con `Session`.
- Fechas nuevas usan hora local mediante `src/utils/fecha.ts`, evitando desfases UTC.
- Ventas mensuales, Estado de Resultados e Impuestos usan `fecha_aceptacion`.
- Cotizaciones usan RPC transaccional para cabecera + ítems.
- Correlativo de cotizaciones se reserva mediante RPC en base de datos.
- Productos usan RPC transaccional para producto + relación proveedor.
- Imágenes de producto restringidas a JPG/PNG/WEBP y 5 MB.
- Preview local de imágenes libera URLs `blob:` al cambiar o desmontar.
- Logo restringido a PNG y 5 MB.
- Pagos a proveedores validan saldo pendiente también en frontend.
- `html2pdf.js` queda como dependencia npm en vez de cargarse por CDN en cada descarga.

## Supabase

- Migración de integridad operacional con:
  - índice UNIQUE para número de cotización;
  - correlativos seguros;
  - transacciones de cotizaciones y productos;
  - backfill e índice de `fecha_aceptacion`;
  - triggers contra sobrepagos de clientes y proveedores.
- Migración de seguridad con RLS por rol y políticas de Storage.
- Edge Function `admin-users` incluida y endurecida con validación server-side de rol admin.

## Automatización

- GitHub Actions ejecuta lint y build en cada push/PR.

## Validación pendiente fuera del código

No se recibió el esquema SQL original ni las políticas actuales de Supabase. Antes de producción debes ejecutar las migraciones primero en staging/copia y revisar políticas antiguas con la consulta de `SECURITY.md`.

El `package-lock.json` no se incluye porque este entorno no pudo acceder al registro npm para regenerarlo después de agregar `html2pdf.js`. Al ejecutar `npm install` en un entorno con Internet se generará un lockfile consistente; conviene hacer commit de ese archivo después de la primera instalación.
