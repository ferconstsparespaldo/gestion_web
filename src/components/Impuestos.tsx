import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMonto, formatearFecha, LOCALE } from '../utils/formato';
import './Finanzas.css';

type ImpuestoMensual = {
  id: string;
  periodo: string;
  iva_debito_estimado: number;
  iva_credito_estimado: number;
  iva_estimado_pagar: number;
  iva_pagado: number;
  ppm_pagado: number;
  fecha_pago: string | null;
  estado: 'Pendiente' | 'Pagado';
  observaciones: string | null;
};

type TabImpuestos = 'resumen' | 'flujo';

type EstadoCobroIva = 'liberado' | 'pendiente';

type CobroFlujo = {
  id: string;
  fecha: string;
  numero: string;
  cliente: string;
  monto: number;
  fechaAceptacion: string | null;
  estadoIva: EstadoCobroIva;
};

const HOY = fechaLocalISO();
const MES_ACTUAL = HOY.slice(0, 7);

function Impuestos() {
  const [tab, setTab] = useState<TabImpuestos>('resumen');
  const [periodo, setPeriodo] = useState(MES_ACTUAL);
  const [historial, setHistorial] = useState<ImpuestoMensual[]>([]);

  const [ivaDebito, setIvaDebito] = useState(0);
  const [ivaCredito, setIvaCredito] = useState(0);
  const [ivaPagar, setIvaPagar] = useState(0);

  const [ivaPagado, setIvaPagado] = useState('');
  const [ppmPagado, setPpmPagado] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [estado, setEstado] = useState<'Pendiente' | 'Pagado'>('Pendiente');
  const [observaciones, setObservaciones] = useState('');

  const [cobrosFlujo, setCobrosFlujo] = useState<CobroFlujo[]>([]);
  const [cargandoFlujo, setCargandoFlujo] = useState(false);

  const [loading, setLoading] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    cargarHistorial();
  }, []);

  useEffect(() => {
    if (!periodo) {
      return;
    }

    cargarPeriodo(periodo);
    cargarFlujo(periodo);
  }, [periodo]);

  async function cargarHistorial() {
    const { data, error } = await supabase
      .from('impuestos_mensuales')
      .select('*')
      .order('periodo', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setHistorial((data || []) as ImpuestoMensual[]);
    setLoading(false);
  }

  async function cargarFlujo(mes: string) {
    setCargandoFlujo(true);

    const [anio, numeroMes] = mes.split('-').map(Number);
    const inicio = `${anio}-${String(numeroMes).padStart(2, '0')}-01`;
    const siguiente =
      numeroMes === 12
        ? `${anio + 1}-01-01`
        : `${anio}-${String(numeroMes + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('pagos_clientes')
      .select(
        `
        id,
        fecha,
        monto,
        cotizaciones (
          numero,
          cliente_razon_social,
          fecha_aceptacion
        )
      `
      )
      .gte('fecha', inicio)
      .lt('fecha', siguiente)
      .order('fecha', { ascending: false });

    if (error) {
      setError(error.message);
      setCargandoFlujo(false);
      return;
    }

    const filas = (
      (data || []) as unknown as Array<{
        id: string;
        fecha: string;
        monto: number;
        cotizaciones: {
          numero: string;
          cliente_razon_social: string;
          fecha_aceptacion: string | null;
        } | null;
      }>
    ).map((fila): CobroFlujo => {
      const fechaAceptacion = fila.cotizaciones?.fecha_aceptacion || null;

      const estadoIva: EstadoCobroIva =
        fechaAceptacion && fechaAceptacion < inicio ? 'liberado' : 'pendiente';

      return {
        id: fila.id,
        fecha: fila.fecha,
        numero: fila.cotizaciones?.numero || '',
        cliente: fila.cotizaciones?.cliente_razon_social || '',
        monto: Number(fila.monto || 0),
        fechaAceptacion,
        estadoIva,
      };
    });

    setCobrosFlujo(filas);
    setCargandoFlujo(false);
  }

  async function cargarPeriodo(mes: string) {
    setCalculando(true);
    setError('');
    setMensaje('');

    const [anio, numeroMes] = mes.split('-').map(Number);
    const inicio = `${anio}-${String(numeroMes).padStart(2, '0')}-01`;
    const siguiente =
      numeroMes === 12
        ? `${anio + 1}-01-01`
        : `${anio}-${String(numeroMes + 1).padStart(2, '0')}-01`;

    const [cotizacionesResult, gastosResult, guardadoResult] = await Promise.all([
      supabase
        .from('cotizaciones')
        .select('iva')
        .in('estado', ['Aceptada', 'Pagada'])
        .gte('fecha_aceptacion', inicio)
        .lt('fecha_aceptacion', siguiente),

      supabase
        .from('gastos')
        .select('iva, considera_iva_credito')
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      supabase
        .from('impuestos_mensuales')
        .select('*')
        .eq('periodo', inicio)
        .maybeSingle(),
    ]);

    if (cotizacionesResult.error) {
      setError(cotizacionesResult.error.message);
      setCalculando(false);
      return;
    }

    if (gastosResult.error) {
      setError(gastosResult.error.message);
      setCalculando(false);
      return;
    }

    if (guardadoResult.error) {
      setError(guardadoResult.error.message);
      setCalculando(false);
      return;
    }

    const debito = (cotizacionesResult.data || []).reduce(
      (total, fila) => total + Number(fila.iva || 0),
      0
    );

    const credito = (gastosResult.data || [])
      .filter((fila) => fila.considera_iva_credito)
      .reduce((total, fila) => total + Number(fila.iva || 0), 0);

    const pagar = Math.max(0, debito - credito);

    setIvaDebito(debito);
    setIvaCredito(credito);
    setIvaPagar(pagar);

    const guardado = guardadoResult.data as ImpuestoMensual | null;

    if (guardado) {
      setIvaPagado(String(Number(guardado.iva_pagado || 0)));
      setPpmPagado(String(Number(guardado.ppm_pagado || 0)));
      setFechaPago(guardado.fecha_pago || '');
      setEstado(guardado.estado);
      setObservaciones(guardado.observaciones || '');
    } else {
      setIvaPagado('');
      setPpmPagado('');
      setFechaPago('');
      setEstado('Pendiente');
      setObservaciones('');
    }

    setCalculando(false);
  }

  async function guardarPeriodo(event: React.FormEvent) {
    event.preventDefault();

    if (!periodo) {
      return;
    }

    if (estado === 'Pagado' && !fechaPago) {
      setError('Si el impuesto está pagado, debes indicar la fecha de pago.');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');

    const inicio = `${periodo}-01`;

    const { error } = await supabase.from('impuestos_mensuales').upsert(
      {
        periodo: inicio,
        iva_debito_estimado: ivaDebito,
        iva_credito_estimado: ivaCredito,
        iva_estimado_pagar: ivaPagar,
        iva_pagado: Number(ivaPagado || 0),
        ppm_pagado: Number(ppmPagado || 0),
        fecha_pago: estado === 'Pagado' ? fechaPago || null : null,
        estado,
        observaciones: observaciones.trim() || null,
      },
      {
        onConflict: 'periodo',
      }
    );

    if (error) {
      setError(error.message);
      setGuardando(false);
      return;
    }

    setMensaje('Resumen tributario guardado correctamente.');
    await cargarHistorial();
    setGuardando(false);
  }

  const totalRegistrado = useMemo(
    () => Number(ivaPagado || 0) + Number(ppmPagado || 0),
    [ivaPagado, ppmPagado]
  );

  const totalLiberado = useMemo(
    () =>
      cobrosFlujo
        .filter((fila) => fila.estadoIva === 'liberado')
        .reduce((total, fila) => total + fila.monto, 0),
    [cobrosFlujo]
  );

  const totalPendiente = useMemo(
    () =>
      cobrosFlujo
        .filter((fila) => fila.estadoIva === 'pendiente')
        .reduce((total, fila) => total + fila.monto, 0),
    [cobrosFlujo]
  );

  function formatoDinero(valor: number) {
    return formatearMonto(valor);
  }

  function formatoPeriodo(valor: string) {
    const fecha = new Date(`${valor.slice(0, 7)}-01T12:00:00`);

    return fecha.toLocaleDateString(LOCALE, {
      month: 'long',
      year: 'numeric',
    });
  }

  function formatoFecha(valor: string | null) {
    if (!valor) {
      return '—';
    }

    return formatearFecha(valor);
  }

  if (loading) {
    return <p>Cargando impuestos...</p>;
  }

  return (
    <div className="module-page">
      <div className="module-header finance-module-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Impuestos</h1>
          <p className="module-description">
            Estimación mensual de IVA y registro de los impuestos realmente pagados.
          </p>
        </div>

        <label className="finance-month-selector">
          Período
          <input
            type="month"
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value)}
          />
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}
      {mensaje && <div className="success-message">{mensaje}</div>}

      <div className="finance-tabs">
        <button
          className={tab === 'resumen' ? 'active' : ''}
          onClick={() => setTab('resumen')}
        >
          Resumen mensual
        </button>

        <button
          className={tab === 'flujo' ? 'active' : ''}
          onClick={() => setTab('flujo')}
        >
          Flujo real (IVA)
        </button>
      </div>

      {tab === 'resumen' && (
        <>
      <div className="finance-kpi-grid">
        <div className="finance-kpi-card">
          <span>IVA débito estimado</span>
          <strong>{formatoDinero(ivaDebito)}</strong>
          <small>Facturas emitidas en el período</small>
        </div>

        <div className="finance-kpi-card">
          <span>IVA crédito estimado</span>
          <strong>{formatoDinero(ivaCredito)}</strong>
          <small>Gastos e IVA de compras de socio marcados como crédito fiscal</small>
        </div>

        <div className="finance-kpi-card">
          <span>IVA estimado a pagar</span>
          <strong>{formatoDinero(ivaPagar)}</strong>
          <small>Débito menos crédito</small>
        </div>

        <div className="finance-kpi-card">
          <span>Total realmente pagado</span>
          <strong>{formatoDinero(totalRegistrado)}</strong>
          <small>IVA pagado + PPM pagado</small>
        </div>
      </div>

      <div className="form-card finance-form-card">
        <div className="finance-form-title">
          <div>
            <p className="eyebrow">PERÍODO TRIBUTARIO</p>
            <h2>{formatoPeriodo(`${periodo}-01`)}</h2>
          </div>

          {calculando && <span className="finance-loading-label">Calculando...</span>}
        </div>

        <form onSubmit={guardarPeriodo}>
          <div className="form-grid">
            <label>
              IVA débito estimado
              <input type="number" value={ivaDebito} readOnly />
            </label>

            <label>
              IVA crédito estimado
              <input type="number" value={ivaCredito} readOnly />
            </label>

            <label>
              IVA estimado a pagar
              <input type="number" value={ivaPagar} readOnly />
            </label>

            <label>
              IVA realmente pagado
              <input
                type="number"
                min="0"
                step="1"
                value={ivaPagado}
                onChange={(event) => setIvaPagado(event.target.value)}
              />
            </label>

            <label>
              PPM realmente pagado
              <input
                type="number"
                min="0"
                step="1"
                value={ppmPagado}
                onChange={(event) => setPpmPagado(event.target.value)}
              />
            </label>

            <label>
              Estado
              <select
                value={estado}
                onChange={(event) =>
                  setEstado(event.target.value as 'Pendiente' | 'Pagado')
                }
              >
                <option value="Pendiente">Pendiente</option>
                <option value="Pagado">Pagado</option>
              </select>
            </label>

            {estado === 'Pagado' && (
              <label>
                Fecha de pago
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(event) => setFechaPago(event.target.value)}
                  required
                />
              </label>
            )}

            <label className="full-width">
              Observaciones
              <textarea
                rows={3}
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </label>
          </div>

          <div className="finance-inline-note">
            El IVA mostrado aquí es una <strong>estimación de gestión</strong>:
            usa el IVA de cotizaciones aceptadas y el IVA crédito de los gastos
            registrados. El monto oficial debe validarse con los documentos
            tributarios y la declaración correspondiente.
          </div>

          <div className="finance-form-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={guardando || calculando}
            >
              {guardando ? 'Guardando...' : 'Guardar período'}
            </button>
          </div>
        </form>
      </div>

      <div className="form-card">
        <div className="finance-list-header">
          <div>
            <h2>Historial mensual</h2>
            <p className="module-description">
              Resumen de los períodos ya guardados.
            </p>
          </div>
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Período</th>
                <th className="right">IVA débito</th>
                <th className="right">IVA crédito</th>
                <th className="right">IVA estimado</th>
                <th className="right">IVA pagado</th>
                <th className="right">PPM pagado</th>
                <th>Fecha pago</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {historial.map((fila) => (
                <tr key={fila.id}>
                  <td>
                    <strong>{formatoPeriodo(fila.periodo)}</strong>
                  </td>
                  <td className="right">
                    {formatoDinero(fila.iva_debito_estimado)}
                  </td>
                  <td className="right">
                    {formatoDinero(fila.iva_credito_estimado)}
                  </td>
                  <td className="right">
                    {formatoDinero(fila.iva_estimado_pagar)}
                  </td>
                  <td className="right">{formatoDinero(fila.iva_pagado)}</td>
                  <td className="right">{formatoDinero(fila.ppm_pagado)}</td>
                  <td>{formatoFecha(fila.fecha_pago)}</td>
                  <td>
                    <span
                      className={`finance-badge ${
                        fila.estado === 'Pagado'
                          ? 'finance-badge-success'
                          : 'finance-badge-warning'
                      }`}
                    >
                      {fila.estado}
                    </span>
                  </td>
                </tr>
              ))}

              {historial.length === 0 && (
                <tr>
                  <td colSpan={8} className="finance-empty">
                    Todavía no hay períodos tributarios guardados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {tab === 'flujo' && (
        <>
          <div className="finance-kpi-grid">
            <div className="finance-kpi-card">
              <span>Cobros con IVA ya liquidado</span>
              <strong className="finance-positive">
                {formatoDinero(totalLiberado)}
              </strong>
              <small>Facturas de meses anteriores: ganancia neta del mes</small>
            </div>

            <div className="finance-kpi-card">
              <span>Cobros de cotizaciones de este mes</span>
              <strong>{formatoDinero(totalPendiente)}</strong>
              <small>Su IVA se paga en el período en que se aceptó la cotización</small>
            </div>
          </div>

          <div className="form-card">
            <div className="finance-list-header">
              <div>
                <h2>Cobros de clientes de {formatoPeriodo(`${periodo}-01`)}</h2>
                <p className="module-description">
                  Cada cobro se clasifica según el mes de aceptación de la
                  cotización que le dio origen, no según el mes del cobro.
                </p>
              </div>

              {cargandoFlujo && (
                <span className="finance-loading-label">Calculando...</span>
              )}
            </div>

            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Fecha cobro</th>
                    <th>Cotización</th>
                    <th>Cliente</th>
                    <th className="right">Monto</th>
                    <th>Fecha aceptación</th>
                    <th>Situación IVA</th>
                  </tr>
                </thead>

                <tbody>
                  {cobrosFlujo.map((fila) => (
                    <tr key={fila.id}>
                      <td>{formatoFecha(fila.fecha)}</td>
                      <td>
                        <strong>{fila.numero || '—'}</strong>
                      </td>
                      <td>{fila.cliente || '—'}</td>
                      <td className="right">{formatoDinero(fila.monto)}</td>
                      <td>{formatoFecha(fila.fechaAceptacion)}</td>
                      <td>
                        {fila.estadoIva === 'liberado' && (
                          <span className="finance-badge finance-badge-success">
                            IVA ya liquidado
                          </span>
                        )}
                        {fila.estadoIva === 'pendiente' && (
                          <span className="finance-badge finance-badge-warning">
                            IVA de este mes
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {cobrosFlujo.length === 0 && (
                    <tr>
                      <td colSpan={6} className="finance-empty">
                        No hay cobros de clientes registrados en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="finance-footnote">
              Este flujo es informativo y complementa al Estado de Resultados
              (que usa fecha de aceptación). Un cobro marcado “IVA ya
              liquidado” corresponde a una factura de un mes anterior: su IVA
              débito ya quedó contabilizado en el resumen de ese mes, por lo
              que el cobro de este mes se puede tratar como ganancia limpia,
              sin volver a restarle IVA en el análisis de caja.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default Impuestos;
