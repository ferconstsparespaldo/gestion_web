import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatearNumero } from '../utils/formato';

type ProductosProps = {
  esAdmin: boolean;
};

type Proveedor = {
  id: string;
  razon_social: string;
};

type ProductoProveedor = {
  id: string;
  proveedor_id: string;
  precio_neto_actual: number;
  beneficio_sugerido: number;
  proveedores?: {
    razon_social: string;
  } | null;
};

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  activo: boolean;
  producto_proveedor?: ProductoProveedor[];
};

type FormProducto = {
  nombre: string;
  descripcion: string;
  categoria: string;
  proveedor_id: string;
  precio_neto_actual: string;
  beneficio_sugerido: string;
};

const productoVacio: FormProducto = {
  nombre: '',
  descripcion: '',
  categoria: '',
  proveedor_id: '',
  precio_neto_actual: '',
  beneficio_sugerido: '',
};

function Productos({ esAdmin }: ProductosProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [relacionEditandoId, setRelacionEditandoId] = useState<string | null>(
    null
  );

  const [form, setForm] = useState<FormProducto>(productoVacio);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setLoading(true);
    setError('');

    const [productosResult, proveedoresResult] = await Promise.all([
      supabase
        .from('productos')
        .select(
          `
            id,
            nombre,
            descripcion,
            categoria,
            activo,
            producto_proveedor (
              id,
              proveedor_id,
              precio_neto_actual,
              beneficio_sugerido,
              proveedores (
                razon_social
              )
            )
          `
        )
        .eq('activo', true)
        .order('nombre'),

      supabase
        .from('proveedores')
        .select('id, razon_social')
        .eq('activo', true)
        .order('razon_social'),
    ]);

    if (productosResult.error) {
      setError(productosResult.error.message);
    } else {
      setProductos((productosResult.data || []) as unknown as Producto[]);
    }

    if (proveedoresResult.error) {
      setError(proveedoresResult.error.message);
    } else {
      setProveedores(proveedoresResult.data || []);
    }

    setLoading(false);
  }

  function nuevoProducto() {
    setForm(productoVacio);

    setEditandoId(null);
    setRelacionEditandoId(null);

    setMostrarFormulario(true);
    setError('');
  }

  function editarProducto(producto: Producto) {
    const relacion = producto.producto_proveedor?.[0];

    setForm({
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || '',
      proveedor_id: relacion?.proveedor_id || '',
      precio_neto_actual: relacion?.precio_neto_actual?.toString() || '',
      beneficio_sugerido: relacion?.beneficio_sugerido?.toString() || '',
    });

    setEditandoId(producto.id);

    setRelacionEditandoId(relacion?.id || null);

    setMostrarFormulario(true);
    setError('');
  }

  function cancelar() {
    setForm(productoVacio);

    setEditandoId(null);
    setRelacionEditandoId(null);

    setMostrarFormulario(false);
    setError('');
  }

  async function guardarProducto(e: React.FormEvent) {
    e.preventDefault();

    setGuardando(true);
    setError('');

    const precioNeto = Number(form.precio_neto_actual || 0);
    const beneficio = Number(form.beneficio_sugerido || 0);

    if (!form.nombre.trim()) {
      setError('Debes ingresar el nombre del producto.');
      setGuardando(false);
      return;
    }

    if (precioNeto < 0 || beneficio < 0) {
      setError('Los precios no pueden ser negativos.');
      setGuardando(false);
      return;
    }

    const datosProducto = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      categoria: form.categoria.trim() || null,
    };

    const datosRelacion = {
      proveedor_id: form.proveedor_id,
      precio_neto_actual: precioNeto,
      beneficio_sugerido: beneficio,
    };

    const { error: guardarError } = await supabase.rpc(
      'guardar_producto_transaccional',
      {
        p_producto_id: editandoId,
        p_relacion_id: relacionEditandoId,
        p_producto: datosProducto,
        p_relacion: datosRelacion,
      }
    );

    if (guardarError) {
      setError(guardarError.message);
      setGuardando(false);
      return;
    }

    await cargarTodo();
    cancelar();
    setGuardando(false);
  }

  async function eliminarProductoCatalogo(producto: Producto) {
    if (!esAdmin || eliminandoId) return;

    const confirmado = window.confirm(
      `¿Eliminar el producto ${producto.nombre}?\n\nEl producto se ocultará del catálogo y no podrá agregarse a nuevas cotizaciones. Las cotizaciones históricas conservarán sus datos.`
    );

    if (!confirmado) return;

    setEliminandoId(producto.id);
    setError('');

    const { error } = await supabase.rpc('desactivar_producto_admin', {
      p_producto_id: producto.id,
    });

    if (error) {
      setError(error.message);
      setEliminandoId(null);
      return;
    }

    if (editandoId === producto.id) {
      cancelar();
    }

    await cargarTodo();
    setEliminandoId(null);
  }

  const productosFiltrados = productos.filter((producto) => {
    const texto = busqueda.toLowerCase();

    const proveedor =
      producto.producto_proveedor?.[0]?.proveedores?.razon_social || '';

    return (
      producto.nombre.toLowerCase().includes(texto) ||
      (producto.categoria || '').toLowerCase().includes(texto) ||
      proveedor.toLowerCase().includes(texto)
    );
  });

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">CATÁLOGO</p>

          <h1>Productos</h1>

          <p className="module-description">
            Administra productos, proveedores y precios netos.
          </p>
        </div>

        <button className="primary-button" onClick={nuevoProducto}>
          + Nuevo producto
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Buscar producto, categoría o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {mostrarFormulario && (
        <div className="form-card">
          <div className="form-title">
            <div>
              <p className="eyebrow">{editandoId ? 'EDITAR' : 'NUEVO'}</p>

              <h2>{editandoId ? 'Editar producto' : 'Nuevo producto'}</h2>
            </div>

            <button className="close-button" onClick={cancelar}>
              ×
            </button>
          </div>

          <form onSubmit={guardarProducto}>
            <div className="form-grid">
              <label>
                Nombre del producto *
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nombre: e.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Categoría
                <input
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categoria: e.target.value,
                    })
                  }
                />
              </label>

              <label className="full-width">
                Descripción
                <textarea
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      descripcion: e.target.value,
                    })
                  }
                />
              </label>

              {/* PROVEEDOR */}

              <label>
                Proveedor (opcional)
                <select
                  value={form.proveedor_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      proveedor_id: e.target.value,
                    })
                  }
                >
                  <option value="">Sin proveedor</option>

                  {proveedores.map((proveedor) => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.razon_social}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Precio neto proveedor *
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.precio_neto_actual}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precio_neto_actual: e.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Beneficio por unidad
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.beneficio_sugerido}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      beneficio_sugerido: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Precio neto sugerido
                <input
                  value={
                    Number(form.precio_neto_actual || 0) +
                    Number(form.beneficio_sugerido || 0)
                  }
                  disabled
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={cancelar}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <p>Cargando productos...</p>
        ) : productosFiltrados.length === 0 ? (
          <div className="empty-state">
            <h3>No hay productos</h3>

            <p>Crea el primer producto para utilizarlo en cotizaciones.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Proveedor</th>
                <th>Costo neto</th>
                <th>Beneficio</th>
                <th>Venta sugerida</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {productosFiltrados.map((producto) => {
                const relacion = producto.producto_proveedor?.[0];

                const costo = Number(relacion?.precio_neto_actual || 0);

                const beneficio = Number(relacion?.beneficio_sugerido || 0);

                return (
                  <tr key={producto.id}>
                    <td>
                      <strong>{producto.nombre}</strong>

                      <div className="small-muted">
                        {producto.categoria || 'Sin categoría'}
                      </div>
                    </td>

                    <td>{relacion?.proveedores?.razon_social || '—'}</td>

                    <td>${formatearNumero(costo)}</td>

                    <td>${formatearNumero(beneficio)}</td>

                    <td>${formatearNumero(costo + beneficio)}</td>

                    <td>
                      <div className="table-row-actions">
                        <button
                          className="table-action"
                          onClick={() => editarProducto(producto)}
                        >
                          Editar
                        </button>

                        {esAdmin && (
                          <button
                            className="table-action danger-text"
                            onClick={() => eliminarProductoCatalogo(producto)}
                            disabled={eliminandoId === producto.id}
                          >
                            {eliminandoId === producto.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Productos;
