# Subir este proyecto a GitHub

## 1. Instalar dependencias

Desde la carpeta del proyecto:

```bash
npm install
```

## 2. Crear `.env`

Duplica `.env.example` como `.env` y completa al menos:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

El resto de variables de `.env.example` son opcionales (locale, moneda,
nombre mostrado en el login, buckets de Storage). No subas `.env` a GitHub.

## 3. Preparar el proyecto Supabase de esta empresa

Primero prueba en staging/copia. Ejecuta en orden, desde el SQL Editor,
todas las migraciones de `supabase/migrations/` (ver el orden y detalle de
cada una en `README.md`).

Luego despliega la Edge Function:

```bash
supabase functions deploy admin-users
```

Revisa `SECURITY.md` para confirmar que no queden políticas RLS antiguas
demasiado abiertas.

## 4. Completar los datos de la empresa

Crea el primer usuario administrador y, ya dentro de la app, completa
**Configuración > Empresa** (razón social, RUT, logo, IVA%, datos bancarios).
Ese es el único paso específico de cada cliente — el código no cambia.

## 5. Probar localmente

```bash
npm run lint
npm run build
npm run dev
```

Prueba login, usuarios, productos, cotizaciones, PDF y finanzas.

## 6. Crear repositorio Git

```bash
git init
git add .
git commit -m "Desplegar plantilla de gestión para nuevo cliente"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

## 7. Desplegar frontend

Para Vercel/Netlify:

- Build command: `npm run build`
- Output: `dist`
- Node: 22.16.0 o compatible `>=22.12 <23`
- Variables: las de `.env.example`

## 8. Revisión final

GitHub Actions ejecutará `npm install`, `npm run lint` y `npm run build`
automáticamente en push y pull requests.
