import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Sector = {
  id: string
  nombre: string
  observaciones: string | null
  activo: boolean
}

type SectoresProps = {
  esAdmin: boolean
}

const sectorVacio = {
  nombre: '',
  observaciones: '',
}

function Sectores({ esAdmin }: SectoresProps) {
  const [sectores, setSectores] = useState<Sector[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(sectorVacio)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarSectores()
  }, [])

  async function cargarSectores() {
    setLoading(true)

    const { data, error } = await supabase
      .from('sectores')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    if (error) {
      setError(error.message)
    } else {
      setSectores(data || [])
    }

    setLoading(false)
  }

  function nuevoSector() {
    setForm(sectorVacio)
    setEditandoId(null)
    setMostrarFormulario(true)
    setError('')
  }

  function editarSector(sector: Sector) {
    setForm({
      nombre: sector.nombre || '',
      observaciones: sector.observaciones || '',
    })

    setEditandoId(sector.id)
    setMostrarFormulario(true)
    setError('')
  }

  function cancelar() {
    setMostrarFormulario(false)
    setEditandoId(null)
    setForm(sectorVacio)
    setError('')
  }

  async function guardarSector(e: React.FormEvent) {
    e.preventDefault()

    setGuardando(true)
    setError('')

    if (editandoId) {
      const { error } = await supabase
        .from('sectores')
        .update(form)
        .eq('id', editandoId)

      if (error) {
        setError(error.message)
        setGuardando(false)
        return
      }
    } else {
      const { error } = await supabase.from('sectores').insert(form)

      if (error) {
        setError(error.message)
        setGuardando(false)
        return
      }
    }

    await cargarSectores()
    cancelar()
    setGuardando(false)
  }

  async function eliminarSector(sector: Sector) {
    if (!esAdmin || eliminandoId) return

    const confirmado = window.confirm(
      `¿Eliminar el sector ${sector.nombre}?\n\nEl sector se ocultará de los listados y no podrá seleccionarse en nuevas cotizaciones. Las cotizaciones históricas conservarán su información.`
    )

    if (!confirmado) return

    setEliminandoId(sector.id)
    setError('')

    const { error } = await supabase.rpc('desactivar_sector_admin', {
      p_sector_id: sector.id,
    })

    if (error) {
      setError(error.message)
      setEliminandoId(null)
      return
    }

    if (editandoId === sector.id) {
      cancelar()
    }

    await cargarSectores()
    setEliminandoId(null)
  }

  const sectoresFiltrados = sectores.filter((sector) => {
    const texto = busqueda.toLowerCase()

    return (
      sector.nombre.toLowerCase().includes(texto) ||
      (sector.observaciones || '').toLowerCase().includes(texto)
    )
  })

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>
          <h1>Sectores</h1>

          <p className="module-description">
            Obras y desarrollos donde trabaja la empresa. Se usan para clasificar las
            cotizaciones.
          </p>
        </div>

        <button className="primary-button" onClick={nuevoSector}>
          + Nuevo sector
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Buscar sector..."
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
              <h2>{editandoId ? 'Editar sector' : 'Nuevo sector'}</h2>
            </div>

            <button className="close-button" onClick={cancelar}>
              ×
            </button>
          </div>

          <form onSubmit={guardarSector}>
            <div className="form-grid">
              <label className="full-width">
                Nombre del sector *
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nombre: e.target.value,
                    })
                  }
                  placeholder="Ej: DV LOS LLANOS"
                  required
                />
              </label>

              <label className="full-width">
                Observaciones
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
                {guardando ? 'Guardando...' : 'Guardar sector'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <p>Cargando sectores...</p>
        ) : sectoresFiltrados.length === 0 ? (
          <div className="empty-state">
            <h3>No hay sectores</h3>
            <p>Crea el primer sector para poder usarlo en las cotizaciones.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sector</th>
                <th>Observaciones</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {sectoresFiltrados.map((sector) => (
                <tr key={sector.id}>
                  <td>
                    <strong>{sector.nombre}</strong>
                  </td>
                  <td>{sector.observaciones || '—'}</td>
                  <td>
                    <div className="table-row-actions">
                      <button
                        className="table-action"
                        onClick={() => editarSector(sector)}
                      >
                        Editar
                      </button>

                      {esAdmin && (
                        <button
                          className="table-action danger-text"
                          onClick={() => eliminarSector(sector)}
                          disabled={eliminandoId === sector.id}
                        >
                          {eliminandoId === sector.id ? 'Eliminando...' : 'Eliminar'}
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

export default Sectores
