import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMontoConSigno, LOCALE } from '../utils/formato';
import './Finanzas.css';

const HOY = fechaLocalISO();
const MES_ACTUAL = HOY.slice(0, 7);

type Resumen = {
  ventasNetas: number;
  costosProductos: number;
  margenBruto: number;
  gastosNetos: number;
  resultadoOperacional: number;
  ivaPagado: number;
  ppmPagado: number;
  resultadoFinal: number;
  ingresosCaja: number;
  pagosProveedores: number;
  gastosPagados: number;
  impuestosPagadosCaja: number;
  egresosCaja: number;
  flujoNeto: number;
};

const VACIO: Resumen = {
  ventasNetas: 0,
  costosProductos: 0,
  margenBruto: 0,
  gastosNetos: 0,
  resultadoOperacional: 0,
  ivaPagado: 0,
  ppmPagado: 0,
  resultadoFinal: 0,
  ingresosCaja: 0,
  pagosProveedores: 0,
  gastosPagados: 0,
  impuestosPagadosCaja: 0,
  egresosCaja: 0,
  flujoNeto: 0,
};

function EstadoResultados() {
  const [periodo, setPeriodo] = useState(MES_ACTUAL);
  const [resumen, setResumen] = useState<Resumen>(VACIO);
  const [cantidadVentas, setCantidadVentas] = useState(0);
  const [cantidadGastos, setCantidadGastos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarResultados();
  }, [periodo]);

  async function cargarResultados() {
    if (!periodo) {
      return;
    }

    setLoading(true);
    setError('');

    const [anio, numeroMes] = periodo.split('-').map(Number);
    const inicio = `${anio}-${String(numeroMes).padStart(2, '0')}-01`;
    const siguiente =
      numeroMes === 12
        ? `${anio + 1}-01-01`
        : `${anio}-${String(numeroMes + 1).padStart(2, '0')}-01`;

    const [
      cotizacionesResult,
      gastosResult,
      gastosPagadosResult,
      pagosClientesResult,
      pagosProveedoresResult,
      impuestoPeriodoResult,
      impuestosCajaResult,
    ] = await Promise.all([
      supabase
        .from('cotizaciones')
        .select('id, neto_total')
        .eq('estado', 'Aceptada')
        .gte('fecha_aceptacion', inicio)
        .lt('fecha_aceptacion', siguiente),

      supabase
        .from('gastos')
        .select('monto_neto, tipo')
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      // El pago real puede caer en un mes distinto al del documento
      // (fecha), por eso se filtra por fecha_pago para la caja real.
      supabase
        .from('gastos')
        .select('monto_liquido, tipo')
        .neq('tipo', 'Socio')
        .gte('fecha_pago', inicio)
        .lt('fecha_pago', siguiente),

      supabase
        .from('pagos_clientes')
        .select('monto')
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      supabase
        .from('pagos_proveedores')
        .select('monto')
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      supabase
        .from('impuestos_mensuales')
        .select('iva_pagado, ppm_pagado')
        .eq('periodo', inicio)
        .maybeSingle(),

      supabase
        .from('impuestos_mensuales')
        .select('iva_pagado, ppm_pagado, fecha_pago')
        .gte('fecha_pago', inicio)
        .lt('fecha_pago', siguiente),
    ]);

    const errores = [
      cotizacionesResult.error,
      gastosResult.error,
      gastosPagadosResult.error,
      pagosClientesResult.error,
      pagosProveedoresResult.error,
      impuestoPeriodoResult.error,
      impuestosCajaResult.error,
    ].filter(Boolean);

    if (errores.length > 0) {
      setError(errores[0]?.message || 'No se pudieron cargar los resultados.');
      setLoading(false);
      return;
    }

    const cotizaciones = cotizacionesResult.data || [];
    const idsCotizaciones = cotizaciones.map((fila) => fila.id);

    let costosProductos = 0;

    if (idsCotizaciones.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('cotizacion_items')
        .select('costo_total')
        .in('cotizacion_id', idsCotizaciones);

      if (itemsError) {
        setError(itemsError.message);
        setLoading(false);
        return;
      }

      costosProductos = (items || []).reduce(
        (total, fila) => total + Number(fila.costo_total || 0),
        0
      );
    }

    const ventasNetas = cotizaciones.reduce(
      (total, fila) => total + Number(fila.neto_total || 0),
      0
    );

    // Las compras de socio (tipo 'Socio') solo aportan crédito de IVA;
    // no son un gasto real de la empresa ni salida de caja.
    const gastos = (gastosResult.data || []).filter(
      (fila) => fila.tipo !== 'Socio'
    );

    const gastosNetos = gastos.reduce(
      (total, fila) => total + Number(fila.monto_neto || 0),
      0
    );

    const gastosPagados = (gastosPagadosResult.data || []).reduce(
      (total, fila) => total + Number(fila.monto_liquido || 0),
      0
    );

    const margenBruto = ventasNetas - costosProductos;
    const resultadoOperacional = margenBruto - gastosNetos;

    const impuestoPeriodo = impuestoPeriodoResult.data;

    const ivaPagado = Number(impuestoPeriodo?.iva_pagado || 0);
    const ppmPagado = Number(impuestoPeriodo?.ppm_pagado || 0);

    // Esta es una vista gerencial solicitada por el negocio.
    // Contablemente el IVA no necesariamente es gasto, por eso también
    // se muestra separado en la sección de caja real.
    const resultadoFinal = resultadoOperacional - ivaPagado - ppmPagado;

    const ingresosCaja = (pagosClientesResult.data || []).reduce(
      (total, fila) => total + Number(fila.monto || 0),
      0
    );

    const pagosProveedores = (pagosProveedoresResult.data || []).reduce(
      (total, fila) => total + Number(fila.monto || 0),
      0
    );

    const impuestosPagadosCaja = (impuestosCajaResult.data || []).reduce(
      (total, fila) =>
        total +
        Number(fila.iva_pagado || 0) +
        Number(fila.ppm_pagado || 0),
      0
    );

    const egresosCaja =
      pagosProveedores + gastosPagados + impuestosPagadosCaja;

    const flujoNeto = ingresosCaja - egresosCaja;

    setResumen({
      ventasNetas,
      costosProductos,
      margenBruto,
      gastosNetos,
      resultadoOperacional,
      ivaPagado,
      ppmPagado,
      resultadoFinal,
      ingresosCaja,
      pagosProveedores,
      gastosPagados,
      impuestosPagadosCaja,
      egresosCaja,
      flujoNeto,
    });

    setCantidadVentas(cotizaciones.length);
    setCantidadGastos(gastos.length);
    setLoading(false);
  }

  function formatoDinero(valor: number) {
    return formatearMontoConSigno(valor);
  }

  function nombreMes() {
    if (!periodo) {
      return '';
    }

    return new Date(`${periodo}-01T12:00:00`).toLocaleDateString(LOCALE, {
      month: 'long',
      year: 'numeric',
    });
  }

  return (
    <div className="module-page">
      <div className="module-header finance-module-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Estado de Resultados</h1>
          <p className="module-description">
            Resultado económico del período y flujo real de dinero separado.
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

      {loading ? (
        <p>Cargando resultados...</p>
      ) : (
        <>
          <div className="finance-kpi-grid">
            <div className="finance-kpi-card">
              <span>Ventas netas</span>
              <strong>{formatoDinero(resumen.ventasNetas)}</strong>
              <small>{cantidadVentas} cotizaciones aceptadas</small>
            </div>

            <div className="finance-kpi-card">
              <span>Margen bruto</span>
              <strong>{formatoDinero(resumen.margenBruto)}</strong>
              <small>Ventas menos costo de productos</small>
            </div>

            <div className="finance-kpi-card">
              <span>Resultado operacional</span>
              <strong>{formatoDinero(resumen.resultadoOperacional)}</strong>
              <small>Después de gastos operacionales</small>
            </div>

            <div className="finance-kpi-card">
              <span>Flujo real del mes</span>
              <strong
                className={
                  resumen.flujoNeto < 0 ? 'finance-negative' : 'finance-positive'
                }
              >
                {formatoDinero(resumen.flujoNeto)}
              </strong>
              <small>Entradas reales menos salidas reales</small>
            </div>
          </div>

          <div className="finance-results-grid">
            <div className="form-card finance-result-card">
              <div className="finance-result-heading">
                <div>
                  <p className="eyebrow">RESULTADO ECONÓMICO</p>
                  <h2>{nombreMes()}</h2>
                </div>
              </div>

              <div className="finance-result-lines">
                <div>
                  <span>Ventas netas</span>
                  <strong>{formatoDinero(resumen.ventasNetas)}</strong>
                </div>

                <div className="negative">
                  <span>− Costos de productos</span>
                  <strong>{formatoDinero(resumen.costosProductos)}</strong>
                </div>

                <div className="subtotal">
                  <span>= Margen bruto</span>
                  <strong>{formatoDinero(resumen.margenBruto)}</strong>
                </div>

                <div className="negative">
                  <span>− Gastos</span>
                  <strong>{formatoDinero(resumen.gastosNetos)}</strong>
                </div>

                <div className="subtotal">
                  <span>= Resultado operacional</span>
                  <strong>{formatoDinero(resumen.resultadoOperacional)}</strong>
                </div>

                <div className="negative">
                  <span>− IVA pagado registrado</span>
                  <strong>{formatoDinero(resumen.ivaPagado)}</strong>
                </div>

                <div className="negative">
                  <span>− PPM pagado registrado</span>
                  <strong>{formatoDinero(resumen.ppmPagado)}</strong>
                </div>

                <div className="grand-total">
                  <span>= Resultado final de gestión</span>
                  <strong>{formatoDinero(resumen.resultadoFinal)}</strong>
                </div>
              </div>

              <p className="finance-footnote">
                Gastos registrados en el período: {cantidadGastos}. Esta pantalla
                es una vista gerencial; el tratamiento contable y tributario
                oficial debe contrastarse con la documentación tributaria.
              </p>
            </div>

            <div className="form-card finance-result-card">
              <div className="finance-result-heading">
                <div>
                  <p className="eyebrow">CAJA REAL</p>
                  <h2>Movimiento efectivo</h2>
                </div>
              </div>

              <div className="finance-result-lines">
                <div className="positive">
                  <span>+ Pagos recibidos de clientes</span>
                  <strong>{formatoDinero(resumen.ingresosCaja)}</strong>
                </div>

                <div className="negative">
                  <span>− Pagos a proveedores</span>
                  <strong>{formatoDinero(resumen.pagosProveedores)}</strong>
                </div>

                <div className="negative">
                  <span>− Gastos marcados como pagados</span>
                  <strong>{formatoDinero(resumen.gastosPagados)}</strong>
                </div>

                <div className="negative">
                  <span>− Impuestos pagados</span>
                  <strong>{formatoDinero(resumen.impuestosPagadosCaja)}</strong>
                </div>

                <div className="subtotal">
                  <span>= Total salidas</span>
                  <strong>{formatoDinero(resumen.egresosCaja)}</strong>
                </div>

                <div className="grand-total">
                  <span>= Flujo neto del mes</span>
                  <strong
                    className={
                      resumen.flujoNeto < 0
                        ? 'finance-negative'
                        : 'finance-positive'
                    }
                  >
                    {formatoDinero(resumen.flujoNeto)}
                  </strong>
                </div>
              </div>

              <p className="finance-footnote">
                Esto muestra movimiento de caja del período, no saldo bancario.
                Los gastos se cuentan según su fecha de pago real, que puede
                ser distinta al mes del documento (ver módulo Gastos). Para
                mostrar “caja disponible” real más adelante debemos registrar
                un saldo inicial o conectar/importar movimientos bancarios.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default EstadoResultados;
