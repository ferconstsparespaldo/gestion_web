import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMonto, formatearFecha } from '../utils/formato';
import './Finanzas.css';

type TabPago = 'movimientos' | 'cobrar';

type Cotizacion = {
  id: string;
  numero: string;
  fecha: string;
  estado: 'Aceptada' | 'Pagada';
  cliente_razon_social: string;
  total_final: number;
};

type PagoCliente = {
  id: string;
  cotizacion_id: string;
  fecha: string;
  monto: number;
  metodo_pago: string | null;
  referencia: string | null;
  observaciones: string | null;
  created_at: string;
  cotizaciones: {
    numero: string;
    cliente_razon_social: string;
    total_final: number;
  } | null;
};

type Movimiento = {
  id: string;
  fecha: string;
  relacionado: string;
  documento: string;
  metodo: string;
  referencia: string;
  monto: number;
};

type PorCobrar = {
  cotizacion_id: string;
  numero: string;
  cliente: string;
  fecha: string;
  total: number;
  pagado: number;
  saldo: number;
};

const HOY = fechaLocalISO();

function Pagos() {
  const [tab, setTab] = useState<TabPago>('movimientos');

  const [pagosClientes, setPagosClientes] = useState<PagoCliente[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [fecha, setFecha] = useState(HOY);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [cotizacionId, setCotizacionId] = useState('');

  const [busqueda, setBusqueda] = useState('');
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

    const [pagosClientesResult, cotizacionesResult] = await Promise.all([
      supabase
        .from('pagos_clientes')
        .select(
          `
          id,
          cotizacion_id,
          fecha,
          monto,
          metodo_pago,
          referencia,
          observaciones,
          created_at,
          cotizaciones (
            numero,
            cliente_razon_social,
            total_final
          )
        `
        )
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false }),

      supabase
        .from('cotizaciones')
        .select(
          `
          id,
          numero,
          fecha,
          estado,
          cliente_razon_social,
          total_final
        `
        )
        .in('estado', ['Aceptada', 'Pagada'])
        .order('fecha', { ascending: false }),
    ]);

    if (pagosClientesResult.error) {
      setError(pagosClientesResult.error.message);
    } else {
      setPagosClientes(
        (pagosClientesResult.data || []) as unknown as PagoCliente[]
      );
    }

    if (cotizacionesResult.error) {
      setError(cotizacionesResult.error.message);
    } else {
      setCotizaciones((cotizacionesResult.data || []) as Cotizacion[]);
    }

    setLoading(false);
  }

  const porCobrar = useMemo<PorCobrar[]>(() => {
    return cotizaciones
      .map((cotizacion) => {
        const pagado = pagosClientes
          .filter((pago) => pago.cotizacion_id === cotizacion.id)
          .reduce((total, pago) => total + Number(pago.monto || 0), 0);

        const total = Number(cotizacion.total_final || 0);

        return {
          cotizacion_id: cotizacion.id,
          numero: cotizacion.numero,
          cliente: cotizacion.cliente_razon_social,
          fecha: cotizacion.fecha,
          total,
          pagado,
          saldo: Math.max(0, total - pagado),
        };
      })
      .filter((fila) => fila.saldo > 0.5)
      .sort((a, b) => b.saldo - a.saldo);
  }, [cotizaciones, pagosClientes]);

  const movimientos = useMemo<Movimiento[]>(() => {
    return pagosClientes
      .map((pago) => ({
        id: pago.id,
        fecha: pago.fecha,
        relacionado: pago.cotizaciones?.cliente_razon_social || 'Cliente',
        documento: pago.cotizaciones?.numero || '',
        metodo: pago.metodo_pago || 'Sin especificar',
        referencia: pago.referencia || '',
        monto: Number(pago.monto || 0),
      }))
      .sort((a, b) => `${b.fecha}-${b.id}`.localeCompare(`${a.fecha}-${a.id}`));
  }, [pagosClientes]);

  const movimientosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) {
      return movimientos;
    }

    return movimientos.filter((movimiento) =>
      [
        movimiento.relacionado,
        movimiento.documento,
        movimiento.metodo,
        movimiento.referencia,
      ]
        .join(' ')
        .toLowerCase()
        .includes(termino)
    );
  }, [movimientos, busqueda]);

  const totalIngresos = useMemo(
    () =>
      pagosClientes.reduce((total, pago) => total + Number(pago.monto || 0), 0),
    [pagosClientes]
  );

  const totalPorCobrar = useMemo(
    () => porCobrar.reduce((total, fila) => total + fila.saldo, 0),
    [porCobrar]
  );

  const saldoCotizacionIngreso = useMemo(() => {
    return (
      porCobrar.find((fila) => fila.cotizacion_id === cotizacionId)?.saldo || 0
    );
  }, [porCobrar, cotizacionId]);

  function abrirFormulario() {
    setFecha(HOY);
    setMonto('');
    setMetodoPago('Transferencia');
    setReferencia('');
    setObservaciones('');
    setCotizacionId('');
    setError('');
    setMensaje('');
    setMostrarFormulario(true);
  }

  async function guardarPago(event: React.FormEvent) {
    event.preventDefault();

    const montoNumero = Number(monto);

    if (!montoNumero || montoNumero <= 0) {
      setError('Debes ingresar un monto mayor a cero.');
      return;
    }

    if (!cotizacionId) {
      setError('Debes seleccionar una cotización.');
      return;
    }

    if (saldoCotizacionIngreso > 0 && montoNumero > saldoCotizacionIngreso + 0.5) {
      setError(
        `El monto supera el saldo pendiente de ${formatoDinero(
          saldoCotizacionIngreso
        )}.`
      );
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('pagos_clientes').insert({
      cotizacion_id: cotizacionId,
      fecha,
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
    setMensaje('Pago registrado correctamente.');
  }

  async function eliminarMovimiento(movimiento: Movimiento) {
    const confirmado = window.confirm(
      `¿Eliminar este ingreso por ${formatoDinero(movimiento.monto)}?`
    );

    if (!confirmado) {
      return;
    }

    const { error } = await supabase
      .from('pagos_clientes')
      .delete()
      .eq('id', movimiento.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMensaje('Movimiento eliminado.');
    await cargarDatos();
  }

  function registrarCobro(fila: PorCobrar) {
    abrirFormulario();
    setCotizacionId(fila.cotizacion_id);
    setMonto(String(Math.round(fila.saldo)));
  }

  function formatoDinero(valor: number) {
    return formatearMonto(valor);
  }

  function formatoFecha(valor: string) {
    if (!valor) {
      return '';
    }

    return formatearFecha(valor);
  }

  if (loading) {
    return <p>Cargando pagos...</p>;
  }

  return (
    <div className="module-page">
      <div className="module-header finance-module-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Pagado</h1>
          <p className="module-description">
            Control de ingresos recibidos y saldos pendientes.
          </p>
        </div>

        <div className="finance-header-actions">
          <button className="primary-button" onClick={() => abrirFormulario()}>
            + Registrar ingreso
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {mensaje && <div className="success-message">{mensaje}</div>}

      <div className="finance-kpi-grid">
        <div className="finance-kpi-card">
          <span>Ingresos registrados</span>
          <strong>{formatoDinero(totalIngresos)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>Por cobrar</span>
          <strong>{formatoDinero(totalPorCobrar)}</strong>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="form-card finance-form-card">
          <div className="finance-form-title">
            <div>
              <p className="eyebrow">NUEVO MOVIMIENTO</p>
              <h2>Pago recibido de cliente</h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setMostrarFormulario(false)}
            >
              Cerrar
            </button>
          </div>

          <form onSubmit={guardarPago}>
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
                Cotización *
                <select
                  value={cotizacionId}
                  onChange={(event) => setCotizacionId(event.target.value)}
                  required
                >
                  <option value="">Seleccionar cotización</option>

                  {porCobrar.map((fila) => (
                    <option key={fila.cotizacion_id} value={fila.cotizacion_id}>
                      {fila.numero} · {fila.cliente} · saldo{' '}
                      {formatoDinero(fila.saldo)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Medio de pago
                <select
                  value={metodoPago}
                  onChange={(event) => setMetodoPago(event.target.value)}
                >
                  <option>Transferencia</option>
                  <option>Tarjeta débito</option>
                  <option>Tarjeta crédito</option>
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

            {cotizacionId && (
              <div className="finance-inline-note">
                Saldo pendiente actual:{' '}
                <strong>{formatoDinero(saldoCotizacionIngreso)}</strong>
              </div>
            )}

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

      <div className="finance-tabs">
        <button
          className={tab === 'movimientos' ? 'active' : ''}
          onClick={() => setTab('movimientos')}
        >
          Movimientos
        </button>

        <button
          className={tab === 'cobrar' ? 'active' : ''}
          onClick={() => setTab('cobrar')}
        >
          Por cobrar
          {porCobrar.length > 0 && <span>{porCobrar.length}</span>}
        </button>
      </div>

      {tab === 'movimientos' && (
        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <h2>Movimientos</h2>
              <p className="module-description">
                Cada fila representa dinero que efectivamente entró.
              </p>
            </div>

            <input
              className="finance-search"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Relacionado</th>
                  <th>Documento</th>
                  <th>Medio</th>
                  <th>Referencia</th>
                  <th className="right">Monto</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {movimientosFiltrados.map((movimiento) => (
                  <tr key={movimiento.id}>
                    <td>{formatoFecha(movimiento.fecha)}</td>
                    <td>{movimiento.relacionado}</td>
                    <td>{movimiento.documento || '—'}</td>
                    <td>{movimiento.metodo}</td>
                    <td>{movimiento.referencia || '—'}</td>
                    <td className="right">
                      <strong>{formatoDinero(movimiento.monto)}</strong>
                    </td>
                    <td className="right">
                      <button
                        className="finance-text-button danger"
                        onClick={() => eliminarMovimiento(movimiento)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}

                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="finance-empty">
                      No hay movimientos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cobrar' && (
        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <h2>Cuentas por cobrar</h2>
              <p className="module-description">
                Cotizaciones aceptadas que todavía tienen saldo pendiente.
              </p>
            </div>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th className="right">Total</th>
                  <th className="right">Pagado</th>
                  <th className="right">Pendiente</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {porCobrar.map((fila) => (
                  <tr key={fila.cotizacion_id}>
                    <td>
                      <strong>{fila.numero}</strong>
                    </td>
                    <td>{fila.cliente}</td>
                    <td>{formatoFecha(fila.fecha)}</td>
                    <td className="right">{formatoDinero(fila.total)}</td>
                    <td className="right">{formatoDinero(fila.pagado)}</td>
                    <td className="right">
                      <strong>{formatoDinero(fila.saldo)}</strong>
                    </td>
                    <td className="right">
                      <button
                        className="finance-text-button"
                        onClick={() => registrarCobro(fila)}
                      >
                        Registrar cobro
                      </button>
                    </td>
                  </tr>
                ))}

                {porCobrar.length === 0 && (
                  <tr>
                    <td colSpan={7} className="finance-empty">
                      No hay cotizaciones pendientes de cobro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pagos;
