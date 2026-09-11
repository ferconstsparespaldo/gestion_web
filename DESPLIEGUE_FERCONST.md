# Checklist de despliegue — Ferconst SpA

Todo el código y las migraciones ya están listos. Esta es la única guía que
necesitas seguir, en orden, apenas tengas acceso a las tres cuentas
(GitHub, Supabase, Vercel). No requiere volver a tocar código — solo
crear cuentas/proyectos y copiar algunos valores.

Tiempo estimado: 30-40 minutos.

---

## 0. Antes de empezar

Verifica que el proyecto compila localmente (ya se probó, pero por si acaso):

```bash
npm install
npm run lint
npm run build
```

Los tres deben terminar sin errores.

---

## 1. GitHub — subir el código

1. Crea un repositorio nuevo y **vacío** en GitHub (sin README, sin
   .gitignore — ya los trae el proyecto). Sugerencia de nombre:
   `ferconst-gestion`.
2. Desde la carpeta `FERCONST/` (ya es un repositorio git local con todo
   comiteado):

   ```bash
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/ferconst-gestion.git
   git push -u origin main
   ```

3. GitHub Actions (`.github/workflows/ci.yml`) va a correr solo, en cada
   push: instala dependencias, lint y build. No necesita ningún secret
   configurado — el build funciona sin credenciales de Supabase porque
   esas variables solo se usan en tiempo de ejecución en el navegador,
   no durante el build.

---

## 2. Supabase — backend

### 2.1 Crear el proyecto

1. [supabase.com](https://supabase.com) → **New project**.
2. Elige una contraseña de base de datos y **guárdala** (Database
   Settings). Región recomendada: la más cercana a Chile (`sa-east-1` /
   São Paulo, si está disponible).
3. Cuando el proyecto termine de aprovisionarse, ve a
   **Project Settings → API** y copia:
   - `Project URL` → esto es `VITE_SUPABASE_URL`.
   - `anon public` key → esto es `VITE_SUPABASE_ANON_KEY`.

   Los vas a necesitar en el paso 3 (Vercel).

### 2.2 Ejecutar las migraciones (en orden)

Ve a **SQL Editor** y ejecuta, uno por uno, **en este orden exacto**, todo
el contenido de cada archivo de `supabase/migrations/`:

1. `202609060000_esquema_base.sql`
2. `202609070001_integridad_operacional.sql`
3. `202609070002_seguridad_rls.sql`
4. `202609080001_eliminacion_admin.sql`
5. `202609080002_gastos_tipo_socio.sql`
6. `202609090001_cotizaciones_fecha_factura.sql`
7. `202609090002_gastos_fecha_pago.sql`
8. `202609090003_capital_socios.sql`
9. `202609090004_capital_socios_permisos.sql`
10. `202609100000_correcciones_proveedores.sql`
11. `202609100001_sectores.sql`
12. `202609100002_cotizaciones_ferconst.sql`
13. `202609100003_productos_proveedor_opcional.sql`
14. `202609100004_numeracion_simple.sql`

Cada una debe terminar con "Success. No rows returned" (o similar). Si
alguna falla, detente y revisa el mensaje antes de seguir con la
siguiente — no te saltes el orden.

> Si prefieres usar Supabase CLI en vez del SQL Editor:
> `supabase link --project-ref TU_REF` y luego `supabase db push`
> (aplica todo `supabase/migrations/` en orden automáticamente).

### 2.3 Cargar los datos iniciales de Ferconst

Todavía en el SQL Editor, ejecuta (en cualquier orden entre ellos):

- `supabase/scripts/cargar_materiales_ferconst.sql` — carga los 118
  materiales del Excel de cotización.
- `supabase/scripts/cargar_configuracion_ferconst.sql` — precarga razón
  social, RUT, correo y teléfono de la empresa.

### 2.4 Desplegar la Edge Function `admin-users`

Necesitas [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
y hacer login (`supabase login`). Luego, desde `FERCONST/`:

```bash
supabase link --project-ref TU_REF
supabase functions deploy admin-users
```

`TU_REF` está en la URL del proyecto o en Project Settings → General.
No necesita variables adicionales: usa `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta automáticamente a toda
Edge Function.

### 2.5 Crear el primer usuario administrador

1. **Authentication → Users → Add user** (o "Invite"). Crea el usuario
   con el correo y contraseña que va a usar el primer administrador.
2. Copia el **UID** de ese usuario (columna `id` en la lista de usuarios).
3. En **SQL Editor**, ejecuta (reemplazando `EL_UID` y `Nombre Apellido`):

   ```sql
   insert into public.profiles (id, nombre, rol, activo)
   values ('EL_UID', 'Nombre Apellido', 'admin', true);
   ```

   Desde ahí, el resto de los usuarios (trabajadores u otros admins) se
   crean directamente desde la app en **Configuración → Usuarios** — ya
   no hace falta volver al SQL Editor.

### 2.6 Buckets de Storage

Ya quedan creados automáticamente por `202609060000_esquema_base.sql`
(`productos` y `assets`, ambos públicos). No requiere ningún paso manual.

---

## 3. Vercel — frontend

1. [vercel.com](https://vercel.com) → **Add New → Project** → importa el
   repositorio `ferconst-gestion` que subiste en el paso 1.
2. Vercel detecta Vite automáticamente (`vercel.json` ya fija
   `buildCommand`, `outputDirectory` e `installCommand` por si acaso).
3. En **Environment Variables**, agrega (Production **y** Preview):

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | el `Project URL` del paso 2.1 |
   | `VITE_SUPABASE_ANON_KEY` | el `anon public` key del paso 2.1 |
   | `VITE_APP_NAME` | `Ferconst SpA` |

   El resto de variables de `.env.example` son opcionales — los valores
   por defecto ya están pensados para una PyME chilena (locale `es-CL`,
   símbolo `$`, nombres de bucket `productos`/`assets`).

4. **Deploy**. Cuando termine, abre la URL que entrega Vercel e inicia
   sesión con el usuario administrador creado en el paso 2.5.

---

## 4. Prueba final (checklist)

Con el sitio ya en Vercel y sesión iniciada como administrador:

- [ ] Login funciona y muestra "Ferconst SpA" en el sidebar.
- [ ] **Configuración → Empresa** ya trae razón social, RUT, correo y
      teléfono precargados (paso 2.3). Sube el logo si tienes uno.
- [ ] **Sectores** ya trae los 9 sectores cargados.
- [ ] **Productos** ya trae los 118 materiales cargados con precio.
- [ ] Crear un **Cliente** de prueba.
- [ ] Crear una **Cotización**: elige cliente, sector, agrega un
      material, revisa que el número asignado sea **203** (o el
      siguiente correlativo si ya generaste alguna de prueba).
- [ ] Completa el bloque de Mano de obra (opcional) y revisa que el
      Costo HH se calcule solo.
- [ ] Genera el PDF y confirma que descargue dentro de una subcarpeta
      `AAAA-MM/` en tu carpeta de Descargas.
- [ ] Crea un segundo usuario (trabajador) desde
      **Configuración → Usuarios** y prueba que no vea Finanzas ni
      Configuración.

Si algo de esto falla, revisa primero el orden de las migraciones
(paso 2.2) — la mayoría de los errores en este tipo de despliegue vienen
de saltarse un archivo o ejecutarlos fuera de orden.

---

## Notas

- `SETUP_GITHUB.md` y el `README.md` traen la versión genérica de estos
  pasos (útil si en el futuro reutilizas esta plantilla para otra
  empresa). Este archivo es la versión ya resuelta específicamente para
  Ferconst.
- Revisa `SECURITY.md` antes de anunciar el sitio como "ya en producción"
  a los trabajadores.
