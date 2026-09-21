import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { STORAGE } from '../lib/storage';
import { formatearNumero } from '../utils/formato';

type ProductosProps = {
  esAdmin: boolean;
};

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  categoria: string | null;
  activo: boolean;
  precio: number;
  costo: number;
};

type FormProducto = {
  nombre: string;
  descripcion: string;
  imagen_url: string;
  categoria: string;
  precio: string;
  costo: string;
};

const productoVacio: FormProducto = {
  nombre: '',
  descripcion: '',
  imagen_url: '',
  categoria: '',
  precio: '',
  costo: '',
};

function Productos({ esAdmin }: ProductosProps) {
  const [productos, setProductos] = useState<Producto[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);

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

    const { data, error: productosError } = await supabase
      .from('productos')
      .select(
        `
          id,
          nombre,
          descripcion,
          imagen_url,
          categoria,
          activo,
          precio,
          costo
        `
      )
      .eq('activo', true)
      .order('nombre');

    if (productosError) {
      setError(productosError.message);
    } else {
      setProductos((data || []) as Producto[]);
    }

    setLoading(false);
  }

  function nuevoProducto() {
    setForm(productoVacio);

    setArchivoImagen(null);
    setPreviewArchivo('');

    setEditandoId(null);

    setMostrarFormulario(true);
    setError('');
  }

  function editarProducto(producto: Producto) {
    setForm({
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      imagen_url: producto.imagen_url || '',
      categoria: producto.categoria || '',
      precio: producto.precio?.toString() || '',
      costo: producto.costo?.toString() || '',
    });

    setArchivoImagen(null);
    setPreviewArchivo('');

    setEditandoId(producto.id);

    setMostrarFormulario(true);
    setError('');
  }

  function cancelar() {
    setForm(productoVacio);

    setArchivoImagen(null);
    setPreviewArchivo('');

    setEditandoId(null);

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

    const precio = Number(form.precio || 0);
    const costo = Number(form.costo || 0);

    if (!form.nombre.trim()) {
      setError('Debes ingresar el nombre del producto.');
      setGuardando(false);
      return;
    }

    if (precio < 0 || costo < 0) {
      setError('El precio y el costo no pueden ser negativos.');
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
      precio,
      costo,
    };

    const { error: guardarError } = await supabase.rpc(
      'guardar_producto_transaccional',
      {
        p_producto_id: editandoId,
        p_producto: datosProducto,
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

    return (
      producto.nombre.toLowerCase().includes(texto) ||
      (producto.categoria || '').toLowerCase().includes(texto)
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
            Administra productos, precios e imágenes.
          </p>
        </div>

        <button className="primary-button" onClick={nuevoProducto}>
          + Nuevo producto
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Buscar producto o categoría..."
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

              {/* PRECIO Y COSTO */}

              <label>
                Costo *
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.costo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      costo: e.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Precio *
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.precio}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      precio: e.target.value,
                    })
                  }
                  required
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
                <th>Costo</th>
                <th>Margen</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {productosFiltrados.map((producto) => {
                const costo = Number(producto.costo || 0);
                const precio = Number(producto.precio || 0);

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

                    <td>${formatearNumero(costo)}</td>

                    <td>${formatearNumero(precio - costo)}</td>

                    <td>${formatearNumero(precio)}</td>

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
