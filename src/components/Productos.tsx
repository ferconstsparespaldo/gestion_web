import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { STORAGE } from '../lib/storage';
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
  imagen_url: string | null;
  categoria: string | null;
  activo: boolean;
  producto_proveedor?: ProductoProveedor[];
};

type FormProducto = {
  nombre: string;
  descripcion: string;
  imagen_url: string;
  categoria: string;
  proveedor_id: string;
  precio_neto_actual: string;
  beneficio_sugerido: string;
};

const productoVacio: FormProducto = {
  nombre: '',
  descripcion: '',
  imagen_url: '',
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

  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);

  const [previewArchivo, setPreviewArchivo] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarTodo();
  }, []);

  useEffect(() => {
    return () => {
      if (previewArchivo.startsWith('blob:')) {
        URL.revokeObjectURL(previewArchivo);
      }
    };
  }, [previewArchivo]);

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
            imagen_url,
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

    setArchivoImagen(null);
    setPreviewArchivo('');

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
      imagen_url: producto.imagen_url || '',
      categoria: producto.categoria || '',
      proveedor_id: relacion?.proveedor_id || '',
      precio_neto_actual: relacion?.precio_neto_actual?.toString() || '',
      beneficio_sugerido: relacion?.beneficio_sugerido?.toString() || '',
    });

    setArchivoImagen(null);
    setPreviewArchivo('');

    setEditandoId(producto.id);

    setRelacionEditandoId(relacion?.id || null);

    setMostrarFormulario(true);
    setError('');
  }

  function cancelar() {
    setForm(productoVacio);

    setArchivoImagen(null);
    setPreviewArchivo('');

    setEditandoId(null);
    setRelacionEditandoId(null);

    setMostrarFormulario(false);
    setError('');
  }

  function seleccionarImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];

    if (!archivo) return;

    const tiposPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (!tiposPermitidos.has(archivo.type)) {
      setError('La imagen debe ser JPG, PNG o WEBP.');
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (archivo.size > maxSize) {
      setError('La imagen no puede pesar más de 5 MB.');
      return;
    }

    setArchivoImagen(archivo);
    setPreviewArchivo(URL.createObjectURL(archivo));

    setError('');
  }

  async function subirImagenSupabase(archivo: File) {
    setSubiendoImagen(true);

    const extension = archivo.name.split('.').pop() || 'jpg';

    const nombreArchivo = `${crypto.randomUUID()}.${extension}`;

    const ruta = `productos/${nombreArchivo}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE.bucketProductos)
      .upload(ruta, archivo, {
        cacheControl: '3600',
        upsert: false,
        contentType: archivo.type,
      });

    if (uploadError) {
      setSubiendoImagen(false);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(STORAGE.bucketProductos)
      .getPublicUrl(ruta);

    setSubiendoImagen(false);

    return { publicUrl: data.publicUrl, ruta };
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

    if (!form.proveedor_id) {
      setError('Debes seleccionar un proveedor.');
      setGuardando(false);
      return;
    }

    if (precioNeto < 0 || beneficio < 0) {
      setError('Los precios no pueden ser negativos.');
      setGuardando(false);
      return;
    }

    let imagenFinal = form.imagen_url.trim() || null;
    let rutaNuevaImagen: string | null = null;

    if (archivoImagen) {
      try {
        const subida = await subirImagenSupabase(archivoImagen);
        imagenFinal = subida.publicUrl;
        rutaNuevaImagen = subida.ruta;
      } catch (err) {
        setError(
          `No se pudo subir la imagen: ${
            err instanceof Error ? err.message : 'Error desconocido'
          }`
        );
        setGuardando(false);
        return;
      }
    }

    const datosProducto = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      imagen_url: imagenFinal,
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
      if (rutaNuevaImagen) {
        await supabase.storage
          .from(STORAGE.bucketProductos)
          .remove([rutaNuevaImagen]);
      }

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

  const imagenPreview = previewArchivo || form.imagen_url;

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">CATÁLOGO</p>

          <h1>Productos</h1>

          <p className="module-description">
            Administra productos, proveedores, precios netos e imágenes.
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

              {/* IMAGEN */}

              <div className="full-width image-section">
                <h3>Imagen del producto</h3>

                <p className="small-muted">
                  Puedes pegar una URL o seleccionar una imagen desde el
                  computador.
                </p>
              </div>

              <label className="full-width">
                URL de imagen
                <input
                  value={form.imagen_url}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      imagen_url: e.target.value,
                    })
                  }
                  placeholder="https://..."
                />
              </label>

              <div className="full-width upload-area">
                <span className="upload-label">O subir desde computador</span>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={seleccionarImagen}
                />

                {archivoImagen && (
                  <p className="small-muted">
                    Archivo seleccionado: <strong>{archivoImagen.name}</strong>
                  </p>
                )}
              </div>

              {imagenPreview && (
                <div className="full-width">
                  <p className="small-muted">Vista previa</p>

                  <div className="product-image-preview">
                    <img
                      src={imagenPreview}
                      alt="Vista previa"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* PROVEEDOR */}

              <label>
                Proveedor *
                <select
                  value={form.proveedor_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      proveedor_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Seleccionar proveedor</option>

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
                disabled={guardando || subiendoImagen}
              >
                {subiendoImagen
                  ? 'Subiendo imagen...'
                  : guardando
                  ? 'Guardando...'
                  : 'Guardar producto'}
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
                <th>Imagen</th>
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
                      {producto.imagen_url ? (
                        <img
                          className="product-table-image"
                          src={producto.imagen_url}
                          alt={producto.nombre}
                        />
                      ) : (
                        '—'
                      )}
                    </td>

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
