-- ============================================================
-- Esquema base de la plantilla
-- DEBE ejecutarse PRIMERO, antes que cualquier otra migración de esta
-- carpeta. Todas las migraciones posteriores (202609070001 en adelante)
-- fueron escritas como parches incrementales sobre una base que en el
-- proyecto original se creó a mano desde el SQL Editor de Supabase y
-- nunca quedó documentada como migración. Este archivo reconstruye esa
-- base a partir del código fuente (columnas y tablas que usan los
-- componentes de src/components) para que un proyecto Supabase nuevo se
-- pueda levantar ejecutando solo el contenido de esta carpeta, en orden.
-- ============================================================

create extension if not exists pgcrypto;

-- Función genérica para mantener updated_at al día.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Perfiles (1 fila por usuario de auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol text not null default 'trabajador',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_rol_check;
alter table public.profiles
  add constraint profiles_rol_check check (rol in ('admin', 'trabajador'));

-- ------------------------------------------------------------
-- Configuración de la empresa (fila única)
-- ------------------------------------------------------------
create table if not exists public.configuracion_empresa (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null default 'Tu Empresa',
  rut text,
  direccion text,
  telefono text,
  correo text,
  logo_url text,
  iva_porcentaje numeric not null default 19,
  vigencia_cotizacion_dias integer not null default 15,
  prefijo_cotizacion text not null default 'COT',
  banco text,
  tipo_cuenta text,
  numero_cuenta text,
  titular text,
  rut_titular text,
  correo_pago text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_configuracion_empresa_updated_at on public.configuracion_empresa;
create trigger trg_configuracion_empresa_updated_at
before update on public.configuracion_empresa
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Clientes
-- ------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  rut text,
  direccion text,
  contacto text,
  telefono text,
  correo text,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
before update on public.clientes
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Proveedores
-- ------------------------------------------------------------
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  rut text,
  direccion text,
  contacto text,
  telefono text,
  correo text,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_proveedores_updated_at on public.proveedores;
create trigger trg_proveedores_updated_at
before update on public.proveedores
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Productos y su relación con proveedores (costo + beneficio)
-- ------------------------------------------------------------
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  imagen_url text,
  categoria text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_productos_updated_at on public.productos;
create trigger trg_productos_updated_at
before update on public.productos
for each row execute function public.set_updated_at();

create table if not exists public.producto_proveedor (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  precio_neto_actual numeric not null default 0,
  beneficio_sugerido numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists producto_proveedor_producto_idx
  on public.producto_proveedor (producto_id);

drop trigger if exists trg_producto_proveedor_updated_at on public.producto_proveedor;
create trigger trg_producto_proveedor_updated_at
before update on public.producto_proveedor
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Cotizaciones e ítems
-- ------------------------------------------------------------
create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  fecha date not null,
  estado text not null default 'Borrador',
  fecha_aceptacion date,

  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_razon_social text,
  cliente_rut text,
  cliente_direccion text,
  cliente_contacto text,
  cliente_telefono text,
  cliente_correo text,

  subtotal_productos_neto numeric not null default 0,
  despacho_neto numeric not null default 0,
  descuento_neto numeric not null default 0,
  neto_total numeric not null default 0,
  iva numeric not null default 0,
  total_final numeric not null default 0,

  vigencia_dias integer not null default 15,
  observaciones text,
  pdf_generado boolean not null default false,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_cotizaciones_updated_at on public.cotizaciones;
create trigger trg_cotizaciones_updated_at
before update on public.cotizaciones
for each row execute function public.set_updated_at();

alter table public.cotizaciones
  drop constraint if exists cotizaciones_estado_check;
alter table public.cotizaciones
  add constraint cotizaciones_estado_check
  check (estado in ('Borrador', 'Modificada', 'Aceptada', 'Rechazada'));

create table if not exists public.cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete set null,

  nombre_producto text not null,
  descripcion text,
  imagen_url text,

  cantidad numeric not null default 1,
  precio_neto_proveedor numeric not null default 0,
  beneficio_unitario numeric not null default 0,
  precio_neto_venta numeric not null default 0,
  costo_total numeric not null default 0,
  beneficio_total numeric not null default 0,
  total_neto_linea numeric not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists cotizacion_items_cotizacion_idx
  on public.cotizacion_items (cotizacion_id);
create index if not exists cotizacion_items_proveedor_idx
  on public.cotizacion_items (proveedor_id);

-- ------------------------------------------------------------
-- Pagos de clientes y a proveedores
-- ------------------------------------------------------------
create table if not exists public.pagos_clientes (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  fecha date not null,
  monto numeric not null,
  metodo_pago text,
  referencia text,
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pagos_clientes_cotizacion_idx
  on public.pagos_clientes (cotizacion_id);

create table if not exists public.pagos_proveedores (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  fecha date not null,
  monto numeric not null,
  numero_documento text,
  metodo_pago text,
  referencia text,
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pagos_proveedores_cotizacion_idx
  on public.pagos_proveedores (cotizacion_id);
create index if not exists pagos_proveedores_proveedor_idx
  on public.pagos_proveedores (proveedor_id);

-- ------------------------------------------------------------
-- Gastos
-- ------------------------------------------------------------
create table if not exists public.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  categoria_id uuid references public.categorias_gasto(id) on delete set null,
  descripcion text,
  proveedor_receptor text,
  monto_neto numeric not null default 0,
  iva numeric not null default 0,
  monto_liquido numeric not null default 0,
  considera_iva_credito boolean not null default true,
  tipo text not null default 'Operacional',
  estado_pago text not null default 'Pendiente',
  fecha_pago date,
  metodo_pago text,
  numero_documento text,
  comprobante_url text,
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.gastos
  drop constraint if exists gastos_estado_pago_check;
alter table public.gastos
  add constraint gastos_estado_pago_check
  check (estado_pago in ('Pendiente', 'Parcial', 'Pagado'));

create index if not exists gastos_fecha_idx on public.gastos (fecha);
create index if not exists gastos_categoria_idx on public.gastos (categoria_id);

-- ------------------------------------------------------------
-- Impuestos mensuales
-- ------------------------------------------------------------
create table if not exists public.impuestos_mensuales (
  id uuid primary key default gen_random_uuid(),
  periodo date not null unique,
  iva_debito_estimado numeric not null default 0,
  iva_credito_estimado numeric not null default 0,
  iva_estimado_pagar numeric not null default 0,
  iva_pagado numeric not null default 0,
  ppm_pagado numeric not null default 0,
  fecha_pago date,
  estado text not null default 'Pendiente',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.impuestos_mensuales
  drop constraint if exists impuestos_mensuales_estado_check;
alter table public.impuestos_mensuales
  add constraint impuestos_mensuales_estado_check
  check (estado in ('Pendiente', 'Pagado'));

drop trigger if exists trg_impuestos_mensuales_updated_at on public.impuestos_mensuales;
create trigger trg_impuestos_mensuales_updated_at
before update on public.impuestos_mensuales
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Storage: buckets usados por la plantilla
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
