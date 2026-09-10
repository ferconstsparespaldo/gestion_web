import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Cliente = {
  id: string;
  razon_social: string;
  rut: string | null;
  direccion: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  observaciones: string | null;
  activo: boolean;
};

type ClientesProps = {
  esAdmin: boolean;
};

const clienteVacio = {
  razon_social: '',
  rut: '',
  direccion: '',
  contacto: '',
  telefono: '',
  correo: '',
  observaciones: '',
};

function Clientes({ esAdmin }: ClientesProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(clienteVacio);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarClientes();
  }, []);

  async function cargarClientes() {
    setLoading(true);

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('activo', true)
      .order('razon_social');

    if (error) {
      setError(error.message);
    } else {
      setClientes(data || []);
    }

    setLoading(false);
  }

  function nuevoCliente() {
    setForm(clienteVacio);
    setEditandoId(null);
    setMostrarFormulario(true);
    setError('');
  }

  function editarCliente(cliente: Cliente) {
    setForm({
      razon_social: cliente.razon_social || '',
      rut: cliente.rut || '',
      direccion: cliente.direccion || '',
      contacto: cliente.contacto || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      observaciones: cliente.observaciones || '',
    });

    setEditandoId(cliente.id);
    setMostrarFormulario(true);
    setError('');
  }

  function cancelar() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setForm(clienteVacio);
    setError('');
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError('');

    if (editandoId) {
      const { error } = await supabase
        .from('clientes')
        .update(form)
        .eq('id', editandoId);

      if (error) {
        setError(error.message);
        setGuardando(false);
        return;
      }
    } else {
      const { error } = await supabase.from('clientes').insert(form);

      if (error) {
        setError(error.message);
        setGuardando(false);
        return;
      }
    }

    await cargarClientes();
    cancelar();
    setGuardando(false);
  }

  async function eliminarCliente(cliente: Cliente) {
    if (!esAdmin || eliminandoId) return;

    const confirmado = window.confirm(
      `¿Eliminar a ${cliente.razon_social}?\n\nEl cliente se ocultará de los listados y no podrá seleccionarse en nuevas cotizaciones. Las cotizaciones históricas se conservarán.`
    );

    if (!confirmado) return;

    setEliminandoId(cliente.id);
    setError('');

    const { error } = await supabase.rpc('desactivar_cliente_admin', {
      p_cliente_id: cliente.id,
    });

    if (error) {
      setError(error.message);
      setEliminandoId(null);
      return;
    }

    if (editandoId === cliente.id) {
      cancelar();
    }

    await cargarClientes();
    setEliminandoId(null);
  }

  const clientesFiltrados = clientes.filter((cliente) => {
    const texto = busqueda.toLowerCase();

    return (
      cliente.razon_social.toLowerCase().includes(texto) ||
      (cliente.rut || '').toLowerCase().includes(texto) ||
      (cliente.contacto || '').toLowerCase().includes(texto)
    );
  });

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>
          <h1>Clientes</h1>
          <p className="module-description">
            Administra los clientes utilizados en las cotizaciones.
          </p>
        </div>

        <button className="primary-button" onClick={nuevoCliente}>
          + Nuevo cliente
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
              <p className="eyebrow">{editandoId ? 'EDITAR' : 'NUEVO'}</p>
              <h2>{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            </div>

            <button className="close-button" onClick={cancelar}>
              ×
            </button>
          </div>

          <form onSubmit={guardarCliente}>
            <div className="form-grid">
              <label>
                Nombre / Razón social *
                <input
                  value={form.razon_social}
                  onChange={(e) =>
                    setForm({ ...form, razon_social: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                RUT
                <input
                  value={form.rut}
                  onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  placeholder="76.123.456-7"
                />
              </label>

              <label className="full-width">
                Dirección
                <input
                  value={form.direccion}
                  onChange={(e) =>
                    setForm({ ...form, direccion: e.target.value })
                  }
                />
              </label>

              <label>
                Nombre de contacto
                <input
                  value={form.contacto}
                  onChange={(e) =>
                    setForm({ ...form, contacto: e.target.value })
                  }
                />
              </label>

              <label>
                Teléfono
                <input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({ ...form, telefono: e.target.value })
                  }
                />
              </label>

              <label className="full-width">
                Correo
                <input
                  type="email"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                />
              </label>

              <label className="full-width">
                Observaciones internas
                <textarea
                  value={form.observaciones}
                  onChange={(e) =>
                    setForm({ ...form, observaciones: e.target.value })
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
                {guardando ? 'Guardando...' : 'Guardar cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <p>Cargando clientes...</p>
        ) : clientesFiltrados.length === 0 ? (
          <div className="empty-state">
            <h3>No hay clientes</h3>
            <p>Crea el primer cliente para comenzar a generar cotizaciones.</p>
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
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>
                    <strong>{cliente.razon_social}</strong>
                  </td>
                  <td>{cliente.rut || '—'}</td>
                  <td>{cliente.contacto || '—'}</td>
                  <td>{cliente.telefono || '—'}</td>
                  <td>{cliente.correo || '—'}</td>
                  <td>
                    <div className="table-row-actions">
                      <button
                        className="table-action"
                        onClick={() => editarCliente(cliente)}
                      >
                        Editar
                      </button>

                      {esAdmin && (
                        <button
                          className="table-action danger-text"
                          onClick={() => eliminarCliente(cliente)}
                          disabled={eliminandoId === cliente.id}
                        >
                          {eliminandoId === cliente.id ? 'Eliminando...' : 'Eliminar'}
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
  );
}

export default Clientes;
