# Plantilla de Gestión PyME

Plantilla reutilizable para una aplicación interna de gestión comercial,
catálogo y finanzas. Construida con React + TypeScript + Vite y Supabase
(autenticación, base de datos, Storage y administración de usuarios).

Pensada para desplegarse **una instancia por empresa**: cada cliente tiene su
propio proyecto Supabase y su propia configuración, sin tocar código.

## Módulos

- Dashboard comercial y financiero.
- Clientes.
- Proveedores.
- Productos y relación producto/proveedor.
- Cotizaciones con vista previa y PDF tamaño Carta.
- Pagos de clientes y proveedores.
- Gastos.
- Estado de resultados.
- Impuestos (pensado para el régimen tributario chileno: IVA, PPM).
- Capital de socios (solo administradores).
- Configuración de empresa y administración de usuarios.

## Cómo está pensada la genericidad

Todo dato propio de una empresa (razón social, RUT, dirección, logo, IVA%,
prefijo de cotización, datos bancarios) vive en la tabla `configuracion_empresa`
y se carga una sola vez en `src/context/EmpresaContext.tsx`, que lo comparte
con toda la app (sidebar, login, PDF de cotizaciones, etc.). **No hay datos de
ninguna empresa hardcodeados en el código fuente.**

Lo único que se configura por variables de entorno (`.env`) es lo que la app
necesita antes de que exista una sesión (pantalla de login) o infraestructura
propia del despliegue (locale, nombres de buckets):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_NAME=
VITE_APP_LOCALE=
VITE_APP_MONEDA_SIMBOLO=
VITE_STORAGE_BUCKET_PRODUCTOS=
VITE_STORAGE_BUCKET_ASSETS=
```

Ver `.env.example` para el detalle de cada una (todas menos las dos primeras
son opcionales, con valores por defecto pensados para una PyME chilena).

## Desplegar esta plantilla para una empresa nueva

1. Crea un proyecto Supabase nuevo (uno por empresa/cliente).
2. Crea los buckets de Storage `productos` y `assets` (o los nombres que
   definas en `VITE_STORAGE_BUCKET_*`).
3. Ejecuta las migraciones de `supabase/migrations/` en orden, desde el SQL
   Editor de Supabase o con Supabase CLI (ver sección siguiente).
4. Despliega la Edge Function `admin-users` (ver más abajo).
5. Clona este repo, instala dependencias y crea tu `.env`:

   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```

6. Crea el primer usuario administrador (Supabase Dashboard > Authentication,
   más una fila en `profiles` con `rol = 'admin'` y `activo = true`).
7. Inicia sesión y completa **Configuración > Empresa** con los datos reales
   del cliente (razón social, RUT, logo, IVA%, datos bancarios). Esto es lo
   único que distingue una instancia de otra: el código es el mismo.
8. Revisa `SECURITY.md` antes de publicar el sistema en Internet.

## Requisitos

- Node.js 22.
- npm.
- Un proyecto Supabase por empresa/cliente.

## Verificaciones antes de desplegar

```bash
npm run lint
npm run build
```

La configuración de CI incluida en `.github/workflows/ci.yml` ejecuta ambas
verificaciones en GitHub.

## Migraciones incluidas

La carpeta `supabase/migrations/` contiene, en orden:

1. `202609070001_integridad_operacional.sql`
   - correlativos seguros para cotizaciones;
   - número de cotización único;
   - guardado transaccional de cotización + ítems;
   - guardado transaccional de producto + proveedor;
   - validación de sobrepagos;
   - backfill de `fecha_aceptacion` para cotizaciones aceptadas históricas.
2. `202609070002_seguridad_rls.sql`
   - helpers de usuario activo/admin;
   - políticas RLS para comercial, configuración y finanzas;
   - políticas de Storage para productos y logo.
3. `202609080001_eliminacion_admin.sql`
   - eliminación/desactivación de registros restringida a administradores.
4. `202609080002_gastos_tipo_socio.sql`
   - columna `tipo` en `gastos` (`Operacional` / `Socio`) para registrar
     compras que un socio paga con su propio dinero. Estos registros solo
     aportan el IVA del documento como crédito fiscal estimado (módulo
     Impuestos); no se cuentan como gasto de la empresa ni afectan el
     resultado operacional ni el flujo de caja (módulo Estado de Resultados).
5. `202609090001_cotizaciones_fecha_factura.sql`
   - columna `fecha_factura` en `cotizaciones` (manual, opcional). El IVA
     débito estimado en Impuestos se calcula según esta fecha (mes en que se
     emitió la factura) en lugar de la fecha de aceptación.
6. `202609090002_gastos_fecha_pago.sql`
   - columna `fecha_pago` en `gastos` (con backfill para los ya marcados
     Pagado). El flujo de caja real (Estado de Resultados y Dashboard) usa
     `fecha_pago` para ubicar la salida de dinero en el mes correcto.
7. `202609090003_capital_socios.sql`
   - tabla `capital_movimientos` (aportes/retiros de capital de los socios),
     con RLS exclusiva para administradores.
8. `202609090004_capital_socios_permisos.sql`
   - revoca el privilegio por defecto de `anon` sobre `capital_movimientos`.

> **Importante:** prueba siempre las migraciones primero en una copia/staging
> de la base Supabase de cada cliente.

## Edge Function `admin-users`

El frontend usa la función `admin-users` para listar, crear y actualizar
usuarios. El código está en `supabase/functions/admin-users/index.ts` y
valida que quien llama tenga un perfil activo con rol `admin` antes de usar
la Admin API de Supabase. No tiene nada específico de ninguna empresa; se
despliega igual en cada proyecto Supabase:

```bash
supabase functions deploy admin-users
```

Usa las variables de entorno del propio proyecto Supabase (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`). Nunca copies la service role key a `.env` del
frontend.

## Criterio de fechas

- `fecha`: emisión de la cotización / actividad comercial;
- `fecha_aceptacion`: momento en que una cotización se convierte en venta;
- `fecha` de pagos, `fecha_pago` de gastos: flujo de caja real.

Dashboard, Estado de Resultados e Impuestos usan `fecha_aceptacion` para
ventas aceptadas del período. Las fechas nuevas se generan con hora local del
navegador (`src/utils/fecha.ts`), evitando desfases por UTC.

## PDF

`html2pdf.js` queda declarado como dependencia npm en lugar de cargarse
dinámicamente desde un CDN.

## Estructura principal

```text
src/
├── components/        (un componente por módulo)
├── context/
│   └── EmpresaContext.tsx   (config de empresa compartida por toda la app)
├── lib/
│   ├── supabase.ts
│   └── storage.ts      (nombres de buckets, configurables por .env)
├── utils/
│   ├── fecha.ts         (fechas locales YYYY-MM-DD)
│   └── formato.ts        (moneda, números, locale, iniciales de marca)
├── App.css
├── Fachada.css
├── App.tsx
└── main.tsx
```

`docs/historial/` conserva notas de la implementación original hecha para el
primer cliente de esta plantilla; no es documentación de uso general.

## Despliegue del frontend

En Vercel, Netlify u otra plataforma para Vite:

- Build command: `npm run build`
- Output directory: `dist`
- Variables de entorno: ver `.env.example`

Después del despliegue prueba, como mínimo:

1. Login admin.
2. Login trabajador.
3. Crear/editar cliente.
4. Crear/editar proveedor.
5. Crear producto con imagen.
6. Crear cotización, guardar, reabrir y descargar PDF (verifica que muestre
   la razón social/logo configurados, no un placeholder).
7. Aceptar/rechazar cotización.
8. Registrar ingreso de cliente.
9. Registrar pago de proveedor y verificar que no permita sobrepago.
10. Gastos, impuestos y estado de resultados.
11. Crear/editar usuario desde Configuración.

Consulta también `SECURITY.md` antes de publicar el sistema en Internet.
