import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Proveedor = {
  id: string
  razon_social: string
  rut: string | null
  direccion: string | null
  contacto: string | null
  telefono: string | null
  correo: string | null
  observaciones: string | null
  activo: boolean
}
type ProveedoresProps = {
  esAdmin: boolean
}

const proveedorVacio = {
  razon_social: '',
  rut: '',
  direccion: '',
  contacto: '',
  telefono: '',
  correo: '',
  observaciones: '',
}

function Proveedores({ esAdmin }: ProveedoresProps) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(proveedorVacio)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarProveedores()
  }, [])

  async function cargarProveedores() {
    setLoading(true)

    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('activo', true)
      .order('razon_social')

    if (error) {
      setError(error.message)
    } else {
      setProveedores(data || [])
    }

    setLoading(false)
  }

  function nuevoProveedor() {
    setForm(proveedorVacio)
    setEditandoId(null)
    setMostrarFormulario(true)
    setError('')
  }

  function editarProveedor(proveedor: Proveedor) {
    setForm({
      razon_social: proveedor.razon_social || '',
      rut: proveedor.rut || '',
      direccion: proveedor.direccion || '',
      contacto: proveedor.contacto || '',
      telefono: proveedor.telefono || '',
      correo: proveedor.correo || '',
      observaciones: proveedor.observaciones || '',
    })

    setEditandoId(proveedor.id)
    setMostrarFormulario(true)
    setError('')
  }

  function cancelar() {
    setMostrarFormulario(false)
    setEditandoId(null)
    setForm(proveedorVacio)
    setError('')
  }

  async function guardarProveedor(e: React.FormEvent) {
    e.preventDefault()

    setGuardando(true)
    setError('')

    if (editandoId) {
      const { error } = await supabase
        .from('proveedores')
        .update(form)
        .eq('id', editandoId)

      if (error) {
        setError(error.message)
        setGuardando(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('proveedores')
        .insert(form)

      if (error) {
        setError(error.message)
        setGuardando(false)
        return
      }
    }

    await cargarProveedores()
    cancelar()
    setGuardando(false)
  }


  async function eliminarProveedor(proveedor: Proveedor) {
    if (!esAdmin || eliminandoId) return

    const confirmado = window.confirm(
      `¿Eliminar al proveedor ${proveedor.razon_social}?\n\nEl proveedor se ocultará de los listados y no podrá seleccionarse en nuevos productos. Los productos, cotizaciones y pagos históricos conservarán su información.`
    )

    if (!confirmado) return

    setEliminandoId(proveedor.id)
    setError('')

    const { error } = await supabase.rpc('desactivar_proveedor_admin', {
      p_proveedor_id: proveedor.id,
    })

    if (error) {
      setError(error.message)
      setEliminandoId(null)
      return
    }

    if (editandoId === proveedor.id) {
      cancelar()
    }

    await cargarProveedores()
    setEliminandoId(null)
  }

  const proveedoresFiltrados = proveedores.filter((proveedor) => {
    const texto = busqueda.toLowerCase()

    return (
      proveedor.razon_social.toLowerCase().includes(texto) ||
      (proveedor.rut || '').toLowerCase().includes(texto) ||
      (proveedor.contacto || '').toLowerCase().includes(texto)
    )
  })

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>
          <h1>Proveedores</h1>

          <p className="module-description">
            Administra los proveedores asociados a los productos.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={nuevoProveedor}
        >
          + Nuevo proveedor
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Buscar por empresa, RUT o contacto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {mostrarFormulario && (
        <div className="form-card">
          <div className="form-title">
            <div>
              <p className="eyebrow">
                {editandoId ? 'EDITAR' : 'NUEVO'}
              </p>

              <h2>
                {editandoId
                  ? 'Editar proveedor'
                  : 'Nuevo proveedor'}
              </h2>
            </div>

            <button className="close-button" onClick={cancelar}>
              ×
            </button>
          </div>

          <form onSubmit={guardarProveedor}>
            <div className="form-grid">
              <label>
                Nombre / Razón social *
                <input
                  value={form.razon_social}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      razon_social: e.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                RUT
                <input
                  value={form.rut}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rut: e.target.value,
                    })
                  }
                />
              </label>

              <label className="full-width">
                Dirección
                <input
                  value={form.direccion}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      direccion: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Contacto
                <input
                  value={form.contacto}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contacto: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Teléfono
                <input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefono: e.target.value,
                    })
                  }
                />
              </label>

              <label className="full-width">
                Correo
                <input
                  type="email"
                  value={form.correo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      correo: e.target.value,
                    })
                  }
                />
              </label>

              <label className="full-width">
                Observaciones internas
                <textarea
                  value={form.observaciones}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      observaciones: e.target.value,
                    })
                  }
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
                {guardando
                  ? 'Guardando...'
                  : 'Guardar proveedor'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <p>Cargando proveedores...</p>
        ) : proveedoresFiltrados.length === 0 ? (
          <div className="empty-state">
            <h3>No hay proveedores</h3>
            <p>
              Crea el primer proveedor para asociarlo a tus productos.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Razón social</th>
                <th>RUT</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {proveedoresFiltrados.map((proveedor) => (
                <tr key={proveedor.id}>
                  <td>
                    <strong>{proveedor.razon_social}</strong>
                  </td>
                  <td>{proveedor.rut || '—'}</td>
                  <td>{proveedor.contacto || '—'}</td>
                  <td>{proveedor.telefono || '—'}</td>
                  <td>{proveedor.correo || '—'}</td>
                  <td>
                    <div className="table-row-actions">
                      <button
                        className="table-action"
                        onClick={() => editarProveedor(proveedor)}
                      >
                        Editar
                      </button>

                      {esAdmin && (
                        <button
                          className="table-action danger-text"
                          onClick={() => eliminarProveedor(proveedor)}
                          disabled={eliminandoId === proveedor.id}
                        >
                          {eliminandoId === proveedor.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Proveedores