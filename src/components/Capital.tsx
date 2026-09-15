import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMontoConSigno, formatearFecha } from '../utils/formato';
import './Finanzas.css';

type TipoCapital = 'Aporte' | 'Retiro';

type MovimientoCapital = {
  id: string;
  fecha: string;
  socio: string;
  tipo: TipoCapital;
  monto: number;
  metodo_pago: string | null;
  referencia: string | null;
  observaciones: string | null;
  created_at: string;
};

const HOY = fechaLocalISO();

function Capital() {
  const [movimientos, setMovimientos] = useState<MovimientoCapital[]>([]);

  const [filtroSocio, setFiltroSocio] = useState('Todos');
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | TipoCapital>('Todos');
  const [busqueda, setBusqueda] = useState('');

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tipo, setTipo] = useState<TipoCapital>('Aporte');
  const [fecha, setFecha] = useState(HOY);
  const [socio, setSocio] = useState('');
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('capital_movimientos')
      .select(
        `
        id,
        fecha,
        socio,
        tipo,
        monto,
        metodo_pago,
        referencia,
        observaciones,
        created_at
      `
      )
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMovimientos((data || []) as MovimientoCapital[]);
    setLoading(false);
  }

  const socios = useMemo(() => {
    const nombres = new Set(movimientos.map((mov) => mov.socio).filter(Boolean));
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, 'es'));
  }, [movimientos]);

  const movimientosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return movimientos.filter((mov) => {
      const coincideSocio = filtroSocio === 'Todos' || mov.socio === filtroSocio;
      const coincideTipo = filtroTipo === 'Todos' || mov.tipo === filtroTipo;

      const coincideBusqueda =
        !termino ||
        [mov.socio, mov.referencia || '', mov.observaciones || '']
          .join(' ')
          .toLowerCase()
          .includes(termino);

      return coincideSocio && coincideTipo && coincideBusqueda;
    });
  }, [movimientos, filtroSocio, filtroTipo, busqueda]);

  const totalAportado = useMemo(
    () =>
      movimientos
        .filter((mov) => mov.tipo === 'Aporte')
        .reduce((total, mov) => total + Number(mov.monto || 0), 0),
    [movimientos]
  );

  const totalRetirado = useMemo(
    () =>
      movimientos
        .filter((mov) => mov.tipo === 'Retiro')
        .reduce((total, mov) => total + Number(mov.monto || 0), 0),
    [movimientos]
  );

  const capitalNeto = totalAportado - totalRetirado;

  const resumenPorSocio = useMemo(() => {
    const agrupado = new Map<string, number>();

    movimientos.forEach((mov) => {
      const signo = mov.tipo === 'Aporte' ? 1 : -1;
      agrupado.set(
        mov.socio,
        (agrupado.get(mov.socio) || 0) + signo * Number(mov.monto || 0)
      );
    });

    return Array.from(agrupado.entries())
      .map(([nombre, neto]) => ({ nombre, neto }))
      .sort((a, b) => b.neto - a.neto);
  }, [movimientos]);

  function abrirFormulario(tipoInicial: TipoCapital) {
    setTipo(tipoInicial);
    setFecha(HOY);
    setSocio('');
    setMonto('');
    setMetodoPago('Transferencia');
    setReferencia('');
    setObservaciones('');
    setError('');
    setMensaje('');
    setMostrarFormulario(true);
  }

  async function guardarMovimiento(event: React.FormEvent) {
    event.preventDefault();

    const montoNumero = Number(monto);

    if (!montoNumero || montoNumero <= 0) {
      setError('Debes ingresar un monto mayor a cero.');
      return;
    }

    if (!socio.trim()) {
      setError('Debes indicar el nombre del socio.');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('capital_movimientos').insert({
      fecha,
      socio: socio.trim(),
      tipo,
      monto: montoNumero,
      metodo_pago: metodoPago || null,
      referencia: referencia.trim() || null,
      observaciones: observaciones.trim() || null,
      created_by: user?.id || null,
    });

    if (error) {
      setError(error.message);
      setGuardando(false);
      return;
    }

    await cargarDatos();

    setGuardando(false);
    setMostrarFormulario(false);
    setMensaje(
      tipo === 'Aporte'
        ? 'Aporte de capital registrado correctamente.'
        : 'Retiro de capital registrado correctamente.'
    );
  }

  async function eliminarMovimiento(mov: MovimientoCapital) {
    const confirmado = window.confirm(
      `¿Eliminar este ${mov.tipo === 'Aporte' ? 'aporte' : 'retiro'} de ${
        mov.socio
      } por ${formatoDinero(mov.monto)}?`
    );

    if (!confirmado) {
      return;
    }

    const { error } = await supabase
      .from('capital_movimientos')
      .delete()
      .eq('id', mov.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMensaje('Movimiento eliminado.');
    await cargarDatos();
  }

  function formatoDinero(valor: number) {
    return formatearMontoConSigno(valor);
  }

  function formatoFecha(valor: string) {
    if (!valor) {
      return '';
    }

    return formatearFecha(valor);
  }

  if (loading) {
    return <p>Cargando capital de socios...</p>;
  }

  return (
    <div className="module-page">
      <div className="module-header finance-module-header">
        <div>
          <p className="eyebrow">FINANZAS · SOLO ADMINISTRADORES</p>
          <h1>Capital de socios</h1>
          <p className="module-description">
            Registro de aportes y retiros de capital de los socios que
            financian la empresa. No forma parte de los ingresos ni gastos
            operacionales del negocio.
          </p>
        </div>

        <div className="finance-header-actions">
          <button
            className="secondary-button"
            onClick={() => abrirFormulario('Retiro')}
          >
            Registrar retiro
          </button>

          <button
            className="primary-button"
            onClick={() => abrirFormulario('Aporte')}
          >
            + Registrar aporte
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {mensaje && <div className="success-message">{mensaje}</div>}

      <div className="finance-kpi-grid">
        <div className="finance-kpi-card">
          <span>Total aportado</span>
          <strong>{formatoDinero(totalAportado)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>Total retirado</span>
          <strong>{formatoDinero(totalRetirado)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>Capital neto actual</span>
          <strong
            className={capitalNeto < 0 ? 'finance-negative' : 'finance-positive'}
          >
            {formatoDinero(capitalNeto)}
          </strong>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="form-card finance-form-card">
          <div className="finance-form-title">
            <div>
              <p className="eyebrow">NUEVO MOVIMIENTO</p>
              <h2>
                {tipo === 'Aporte'
                  ? 'Aporte de capital de un socio'
                  : 'Retiro de capital de un socio'}
              </h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setMostrarFormulario(false)}
            >
              Cerrar
            </button>
          </div>

          <form onSubmit={guardarMovimiento}>
            <div className="finance-type-selector">
              <button
                type="button"
                className={tipo === 'Aporte' ? 'active' : ''}
                onClick={() => setTipo('Aporte')}
              >
                Aporte (entra capital)
              </button>

              <button
                type="button"
                className={tipo === 'Retiro' ? 'active' : ''}
                onClick={() => setTipo('Retiro')}
              >
                Retiro (sale capital)
              </button>
            </div>

            <div className="form-grid">
              <label>
                Fecha
                <input
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  required
                />
              </label>

              <label>
                Monto
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={monto}
                  onChange={(event) => setMonto(event.target.value)}
                  required
                />
              </label>

              <label className="full-width">
                Socio *
                <input
                  list="lista-socios-capital"
                  value={socio}
                  onChange={(event) => setSocio(event.target.value)}
                  placeholder="Nombre del socio"
                  required
                />

                <datalist id="lista-socios-capital">
                  {socios.map((nombre) => (
                    <option key={nombre} value={nombre} />
                  ))}
                </datalist>
              </label>

              <label>
                Medio de pago
                <select
                  value={metodoPago}
                  onChange={(event) => setMetodoPago(event.target.value)}
                >
                  <option>Transferencia</option>
                  <option>Efectivo</option>
                  <option>Cheque</option>
                  <option>Otro</option>
                </select>
              </label>

              <label>
                Referencia
                <input
                  value={referencia}
                  onChange={(event) => setReferencia(event.target.value)}
                  placeholder="N° transferencia, comprobante..."
                />
              </label>

              <label className="full-width">
                Observaciones
                <textarea
                  rows={3}
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                />
              </label>
            </div>

            <div className="finance-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setMostrarFormulario(false)}
              >
                Cancelar
              </button>

              <button
                className="primary-button"
                type="submit"
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar movimiento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="finance-dashboard-grid">
        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <h2>Movimientos</h2>
              <p className="module-description">
                Aportes y retiros de capital registrados.
              </p>
            </div>

            <div className="finance-filters">
              <select
                value={filtroSocio}
                onChange={(event) => setFiltroSocio(event.target.value)}
              >
                <option value="Todos">Todos los socios</option>

                {socios.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>

              <select
                value={filtroTipo}
                onChange={(event) =>
                  setFiltroTipo(event.target.value as 'Todos' | TipoCapital)
                }
              >
                <option value="Todos">Aportes y retiros</option>
                <option value="Aporte">Solo aportes</option>
                <option value="Retiro">Solo retiros</option>
              </select>

              <input
                className="finance-search"
                placeholder="Buscar..."
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </div>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Socio</th>
                  <th>Tipo</th>
                  <th>Medio</th>
                  <th>Referencia</th>
                  <th className="right">Monto</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {movimientosFiltrados.map((mov) => (
                  <tr key={mov.id}>
                    <td>{formatoFecha(mov.fecha)}</td>
                    <td>{mov.socio}</td>
                    <td>
                      <span
                        className={`finance-badge ${
                          mov.tipo === 'Aporte'
                            ? 'finance-badge-success'
                            : 'finance-badge-expense'
                        }`}
                      >
                        {mov.tipo}
                      </span>
                    </td>
                    <td>{mov.metodo_pago || '—'}</td>
                    <td>{mov.referencia || '—'}</td>
                    <td className="right">
                      <strong>{formatoDinero(mov.monto)}</strong>
                    </td>
                    <td className="right">
                      <button
                        className="finance-text-button danger"
                        onClick={() => eliminarMovimiento(mov)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}

                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="finance-empty">
                      No hay movimientos de capital registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <p className="eyebrow">POR SOCIO</p>
              <h2>Capital neto aportado</h2>
            </div>
          </div>

          <div className="finance-ranking">
            {resumenPorSocio.map((fila, index) => (
              <div key={fila.nombre}>
                <span className="finance-rank-number">{index + 1}</span>
                <span>{fila.nombre}</span>
                <strong
                  className={
                    fila.neto < 0 ? 'finance-negative' : 'finance-positive'
                  }
                >
                  {formatoDinero(fila.neto)}
                </strong>
              </div>
            ))}

            {resumenPorSocio.length === 0 && (
              <p className="finance-empty">Sin movimientos todavía.</p>
            )}
          </div>

          <p className="finance-footnote">
            Aportes menos retiros por socio, histórico completo.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Capital;
