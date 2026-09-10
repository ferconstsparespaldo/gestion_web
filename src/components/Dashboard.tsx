import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMontoConSigno, formatearFecha, LOCALE } from '../utils/formato';
import './Finanzas.css';

type DashboardProps = {
  esAdmin: boolean;
  cambiarPagina: (
    pagina:
      | 'clientes'
      | 'cotizaciones'
      | 'productos'
      | 'proveedores'
      | 'pagos'
      | 'gastos'
      | 'resultados'
      | 'impuestos'
  ) => void;
};

type Cotizacion = {
  id: string;
  numero: string;
  fecha: string;
  fecha_aceptacion: string | null;
  estado: string;
  cliente_razon_social: string;
  neto_total: number;
  iva: number;
  total_final: number;
};

type Item = {
  cotizacion_id: string;
  nombre_producto: string;
  cantidad: number;
  costo_total: number;
  total_neto_linea: number;
};

const HOY = fechaLocalISO();

function Dashboard({ esAdmin, cambiarPagina }: DashboardProps) {
  const [cotizacionesMes, setCotizacionesMes] = useState<Cotizacion[]>([]);
  const [cotizacionesAceptadasMes, setCotizacionesAceptadasMes] = useState<Cotizacion[]>([]);
  const [cotizacionesAceptadasTodas, setCotizacionesAceptadasTodas] = useState<
    Cotizacion[]
  >([]);
  const [cotizacionesRecientes, setCotizacionesRecientes] = useState<Cotizacion[]>([]);
  const [itemsMes, setItemsMes] = useState<Item[]>([]);
  const [pagosClientesMes, setPagosClientesMes] = useState<number[]>([]);
  const [pagosClientesTodos, setPagosClientesTodos] = useState<
    { cotizacion_id: string; monto: number }[]
  >([]);
  const [pagosProveedoresMes, setPagosProveedoresMes] = useState<number[]>([]);
  const [gastosMes, setGastosMes] = useState<
    { monto_neto: number; monto_liquido: number; estado_pago: string; tipo: string }[]
  >([]);
  const [impuestoMes, setImpuestoMes] = useState<{
    iva_estimado_pagar: number;
    iva_pagado: number;
    ppm_pagado: number;
    estado: string;
  } | null>(null);
  const [impuestosCajaMes, setImpuestosCajaMes] = useState<
    { iva_pagado: number; ppm_pagado: number }[]
  >([]);
  const [gastosPagadosMesData, setGastosPagadosMesData] = useState<
    { monto_liquido: number }[]
  >([]);

  const [pagosClientesMesAnterior, setPagosClientesMesAnterior] = useState<
    number[]
  >([]);
  const [pagosProveedoresMesAnterior, setPagosProveedoresMesAnterior] =
    useState<number[]>([]);
  const [impuestosCajaMesAnterior, setImpuestosCajaMesAnterior] = useState<
    { iva_pagado: number; ppm_pagado: number }[]
  >([]);
  const [gastosPagadosMesAnteriorData, setGastosPagadosMesAnteriorData] =
    useState<{ monto_liquido: number }[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarDashboard();
  }, [esAdmin]);

  async function cargarDashboard() {
    setLoading(true);
    setError('');

    const [anio, numeroMes] = HOY.slice(0, 7).split('-').map(Number);
    const inicio = `${anio}-${String(numeroMes).padStart(2, '0')}-01`;
    const siguiente =
      numeroMes === 12
        ? `${anio + 1}-01-01`
        : `${anio}-${String(numeroMes + 1).padStart(2, '0')}-01`;

    const anioAnterior = numeroMes === 1 ? anio - 1 : anio;
    const numeroMesAnterior = numeroMes === 1 ? 12 : numeroMes - 1;
    const inicioAnterior = `${anioAnterior}-${String(numeroMesAnterior).padStart(2, '0')}-01`;
    const siguienteAnterior = inicio;

    // Un trabajador no debe consultar tablas financieras.
    // Esto es importante cuando RLS está activo: el Dashboard sigue funcionando
    // con información comercial sin intentar acceder a datos exclusivos de Admin.
    if (!esAdmin) {
      const [
        cotMesResult,
        cotAceptadasMesResult,
        cotAceptadasTodasResult,
        recientesResult,
      ] = await Promise.all([
          supabase
            .from('cotizaciones')
            .select(
              'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
            )
            .gte('fecha', inicio)
            .lt('fecha', siguiente),

          supabase
            .from('cotizaciones')
            .select(
              'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
            )
            .eq('estado', 'Aceptada')
            .gte('fecha_aceptacion', inicio)
            .lt('fecha_aceptacion', siguiente),

          supabase
            .from('cotizaciones')
            .select(
              'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
            )
            .eq('estado', 'Aceptada'),

          supabase
            .from('cotizaciones')
            .select(
              'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
            )
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

      const erroresComerciales = [
        cotMesResult.error,
        cotAceptadasMesResult.error,
        cotAceptadasTodasResult.error,
        recientesResult.error,
      ].filter(Boolean);

      if (erroresComerciales.length > 0) {
        setError(
          erroresComerciales[0]?.message ||
            'No se pudo cargar la información comercial del dashboard.'
        );
        setLoading(false);
        return;
      }

      const cotMes = (cotMesResult.data || []) as Cotizacion[];
      const cotAceptadasMes = (cotAceptadasMesResult.data || []) as Cotizacion[];
      const cotAceptadasTodas =
        (cotAceptadasTodasResult.data || []) as Cotizacion[];

      setCotizacionesMes(cotMes);
      setCotizacionesAceptadasMes(cotAceptadasMes);
      setCotizacionesAceptadasTodas(cotAceptadasTodas);
      setCotizacionesRecientes(
        (recientesResult.data || []) as Cotizacion[]
      );

      const idsAceptadasMes = cotAceptadasMes.map((fila) => fila.id);

      if (idsAceptadasMes.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('cotizacion_items')
          .select(
            'cotizacion_id, nombre_producto, cantidad, costo_total, total_neto_linea'
          )
          .in('cotizacion_id', idsAceptadasMes);

        if (itemsError) {
          setError(itemsError.message);
          setLoading(false);
          return;
        }

        setItemsMes((items || []) as Item[]);
      } else {
        setItemsMes([]);
      }

      setPagosClientesMes([]);
      setPagosClientesTodos([]);
      setPagosProveedoresMes([]);
      setGastosMes([]);
      setImpuestoMes(null);
      setImpuestosCajaMes([]);
      setPagosClientesMesAnterior([]);
      setPagosProveedoresMesAnterior([]);
      setImpuestosCajaMesAnterior([]);
      setGastosPagadosMesData([]);
      setGastosPagadosMesAnteriorData([]);
      setLoading(false);
      return;
    }

    const [
      cotMesResult,
      cotAceptadasMesResult,
      cotAceptadasTodasResult,
      recientesResult,
      pagosClientesMesResult,
      pagosClientesTodosResult,
      pagosProveedoresMesResult,
      gastosResult,
      impuestoMesResult,
      impuestosCajaResult,
      gastosPagadosMesResult,
      pagosClientesMesAnteriorResult,
      pagosProveedoresMesAnteriorResult,
      impuestosCajaMesAnteriorResult,
      gastosPagadosMesAnteriorResult,
    ] = await Promise.all([
      supabase
        .from('cotizaciones')
        .select(
          'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
        )
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      supabase
        .from('cotizaciones')
        .select(
          'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
        )
        .eq('estado', 'Aceptada')
        .gte('fecha_aceptacion', inicio)
        .lt('fecha_aceptacion', siguiente),

      supabase
        .from('cotizaciones')
        .select(
          'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
        )
        .eq('estado', 'Aceptada'),

      supabase
        .from('cotizaciones')
        .select(
          'id, numero, fecha, fecha_aceptacion, estado, cliente_razon_social, neto_total, iva, total_final'
        )
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('pagos_clientes')
        .select('monto')
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      supabase.from('pagos_clientes').select('cotizacion_id, monto'),

      supabase
        .from('pagos_proveedores')
        .select('monto')
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      supabase
        .from('gastos')
        .select('monto_neto, monto_liquido, estado_pago, tipo')
        .gte('fecha', inicio)
        .lt('fecha', siguiente),

      supabase
        .from('impuestos_mensuales')
        .select('iva_estimado_pagar, iva_pagado, ppm_pagado, estado')
        .eq('periodo', inicio)
        .maybeSingle(),

      supabase
        .from('impuestos_mensuales')
        .select('iva_pagado, ppm_pagado')
        .gte('fecha_pago', inicio)
        .lt('fecha_pago', siguiente),

      // El pago real puede caer en un mes distinto al del documento
      // (fecha), por eso se filtra por fecha_pago para el flujo real.
      supabase
        .from('gastos')
        .select('monto_liquido')
        .neq('tipo', 'Socio')
        .gte('fecha_pago', inicio)
        .lt('fecha_pago', siguiente),

      supabase
        .from('pagos_clientes')
        .select('monto')
        .gte('fecha', inicioAnterior)
        .lt('fecha', siguienteAnterior),

      supabase
        .from('pagos_proveedores')
        .select('monto')
        .gte('fecha', inicioAnterior)
        .lt('fecha', siguienteAnterior),

      supabase
        .from('impuestos_mensuales')
        .select('iva_pagado, ppm_pagado')
        .gte('fecha_pago', inicioAnterior)
        .lt('fecha_pago', siguienteAnterior),

      supabase
        .from('gastos')
        .select('monto_liquido')
        .neq('tipo', 'Socio')
        .gte('fecha_pago', inicioAnterior)
        .lt('fecha_pago', siguienteAnterior),
    ]);

    const errores = [
      cotMesResult.error,
      cotAceptadasMesResult.error,
      cotAceptadasTodasResult.error,
      recientesResult.error,
      pagosClientesMesResult.error,
      pagosClientesTodosResult.error,
      pagosProveedoresMesResult.error,
      gastosResult.error,
      impuestoMesResult.error,
      impuestosCajaResult.error,
      gastosPagadosMesResult.error,
      pagosClientesMesAnteriorResult.error,
      pagosProveedoresMesAnteriorResult.error,
      impuestosCajaMesAnteriorResult.error,
      gastosPagadosMesAnteriorResult.error,
    ].filter(Boolean);

    if (errores.length > 0) {
      setError(errores[0]?.message || 'No se pudo cargar el dashboard.');
      setLoading(false);
      return;
    }

    const cotMes = (cotMesResult.data || []) as Cotizacion[];
    const cotAceptadasMes = (cotAceptadasMesResult.data || []) as Cotizacion[];
    const cotAceptadasTodas = (cotAceptadasTodasResult.data || []) as Cotizacion[];

    setCotizacionesMes(cotMes);
    setCotizacionesAceptadasMes(cotAceptadasMes);
    setCotizacionesAceptadasTodas(cotAceptadasTodas);
    setCotizacionesRecientes((recientesResult.data || []) as Cotizacion[]);

    const idsAceptadasMes = cotAceptadasMes.map((fila) => fila.id);

    if (idsAceptadasMes.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('cotizacion_items')
        .select(
          'cotizacion_id, nombre_producto, cantidad, costo_total, total_neto_linea'
        )
        .in('cotizacion_id', idsAceptadasMes);

      if (itemsError) {
        setError(itemsError.message);
        setLoading(false);
        return;
      }

      setItemsMes((items || []) as Item[]);
    } else {
      setItemsMes([]);
    }

    setPagosClientesMes(
      (pagosClientesMesResult.data || []).map((fila) => Number(fila.monto || 0))
    );
    setPagosClientesTodos(
      (pagosClientesTodosResult.data || []).map((fila) => ({
        cotizacion_id: fila.cotizacion_id,
        monto: Number(fila.monto || 0),
      }))
    );
    setPagosProveedoresMes(
      (pagosProveedoresMesResult.data || []).map((fila) =>
        Number(fila.monto || 0)
      )
    );
    setGastosMes(
      (gastosResult.data || []).map((fila) => ({
        monto_neto: Number(fila.monto_neto || 0),
        monto_liquido: Number(fila.monto_liquido || 0),
        estado_pago: fila.estado_pago,
        tipo: fila.tipo,
      }))
    );

    setImpuestoMes(
      impuestoMesResult.data
        ? {
            iva_estimado_pagar: Number(
              impuestoMesResult.data.iva_estimado_pagar || 0
            ),
            iva_pagado: Number(impuestoMesResult.data.iva_pagado || 0),
            ppm_pagado: Number(impuestoMesResult.data.ppm_pagado || 0),
            estado: impuestoMesResult.data.estado,
          }
        : null
    );

    setImpuestosCajaMes(
      (impuestosCajaResult.data || []).map((fila) => ({
        iva_pagado: Number(fila.iva_pagado || 0),
        ppm_pagado: Number(fila.ppm_pagado || 0),
      }))
    );
    setGastosPagadosMesData(
      (gastosPagadosMesResult.data || []).map((fila) => ({
        monto_liquido: Number(fila.monto_liquido || 0),
      }))
    );

    setPagosClientesMesAnterior(
      (pagosClientesMesAnteriorResult.data || []).map((fila) =>
        Number(fila.monto || 0)
      )
    );
    setPagosProveedoresMesAnterior(
      (pagosProveedoresMesAnteriorResult.data || []).map((fila) =>
        Number(fila.monto || 0)
      )
    );
    setImpuestosCajaMesAnterior(
      (impuestosCajaMesAnteriorResult.data || []).map((fila) => ({
        iva_pagado: Number(fila.iva_pagado || 0),
        ppm_pagado: Number(fila.ppm_pagado || 0),
      }))
    );
    setGastosPagadosMesAnteriorData(
      (gastosPagadosMesAnteriorResult.data || []).map((fila) => ({
        monto_liquido: Number(fila.monto_liquido || 0),
      }))
    );

    setLoading(false);
  }

  const aceptadasMes = useMemo(
    () => cotizacionesAceptadasMes,
    [cotizacionesAceptadasMes]
  );

  const aceptadasDeCotizacionesEmitidasMes = useMemo(
    () => cotizacionesMes.filter((fila) => fila.estado === 'Aceptada'),
    [cotizacionesMes]
  );

  const ventasMes = useMemo(
    () =>
      aceptadasMes.reduce(
        (total, fila) => total + Number(fila.total_final || 0),
        0
      ),
    [aceptadasMes]
  );

  const ventasNetasMes = useMemo(
    () =>
      aceptadasMes.reduce(
        (total, fila) => total + Number(fila.neto_total || 0),
        0
      ),
    [aceptadasMes]
  );

  const costosMes = useMemo(
    () =>
      itemsMes.reduce(
        (total, fila) => total + Number(fila.costo_total || 0),
        0
      ),
    [itemsMes]
  );

  const cobradoMes = useMemo(
    () => pagosClientesMes.reduce((total, valor) => total + valor, 0),
    [pagosClientesMes]
  );

  const pagosProveedorMes = useMemo(
    () => pagosProveedoresMes.reduce((total, valor) => total + valor, 0),
    [pagosProveedoresMes]
  );

  // Las compras de socio (tipo 'Socio') solo aportan crédito de IVA; no son
  // gasto real de la empresa ni salida de caja (ver módulo Gastos).
  const gastosNetosMes = useMemo(
    () =>
      gastosMes
        .filter((fila) => fila.tipo !== 'Socio')
        .reduce((total, fila) => total + Number(fila.monto_neto || 0), 0),
    [gastosMes]
  );

  // Se cuenta por fecha_pago (pago real), no por la fecha del documento.
  const gastosPagadosMes = useMemo(
    () =>
      gastosPagadosMesData.reduce(
        (total, fila) => total + Number(fila.monto_liquido || 0),
        0
      ),
    [gastosPagadosMesData]
  );

  const impuestosPagadosCaja = useMemo(
    () =>
      impuestosCajaMes.reduce(
        (total, fila) => total + fila.iva_pagado + fila.ppm_pagado,
        0
      ),
    [impuestosCajaMes]
  );

  const resultadoMes = useMemo(
    () =>
      ventasNetasMes -
      costosMes -
      gastosNetosMes -
      Number(impuestoMes?.iva_pagado || 0) -
      Number(impuestoMes?.ppm_pagado || 0),
    [ventasNetasMes, costosMes, gastosNetosMes, impuestoMes]
  );

  const flujoMes = useMemo(
    () =>
      cobradoMes - pagosProveedorMes - gastosPagadosMes - impuestosPagadosCaja,
    [cobradoMes, pagosProveedorMes, gastosPagadosMes, impuestosPagadosCaja]
  );

  const cobradoMesAnterior = useMemo(
    () => pagosClientesMesAnterior.reduce((total, valor) => total + valor, 0),
    [pagosClientesMesAnterior]
  );

  const pagosProveedorMesAnterior = useMemo(
    () =>
      pagosProveedoresMesAnterior.reduce((total, valor) => total + valor, 0),
    [pagosProveedoresMesAnterior]
  );

  const gastosPagadosMesAnterior = useMemo(
    () =>
      gastosPagadosMesAnteriorData.reduce(
        (total, fila) => total + Number(fila.monto_liquido || 0),
        0
      ),
    [gastosPagadosMesAnteriorData]
  );

  const impuestosPagadosCajaMesAnterior = useMemo(
    () =>
      impuestosCajaMesAnterior.reduce(
        (total, fila) => total + fila.iva_pagado + fila.ppm_pagado,
        0
      ),
    [impuestosCajaMesAnterior]
  );

  const flujoMesAnterior = useMemo(
    () =>
      cobradoMesAnterior -
      pagosProveedorMesAnterior -
      gastosPagadosMesAnterior -
      impuestosPagadosCajaMesAnterior,
    [
      cobradoMesAnterior,
      pagosProveedorMesAnterior,
      gastosPagadosMesAnterior,
      impuestosPagadosCajaMesAnterior,
    ]
  );

  const nombreMesActual = useMemo(
    () =>
      HOY
        ? new Date(`${HOY.slice(0, 7)}-01T12:00:00`).toLocaleDateString(
            LOCALE,
            { month: 'long', year: 'numeric' }
          )
        : '',
    []
  );

  const nombreMesAnterior = useMemo(() => {
    const [anio, mes] = HOY.slice(0, 7).split('-').map(Number);
    const anioAnterior = mes === 1 ? anio - 1 : anio;
    const mesAnterior = mes === 1 ? 12 : mes - 1;

    return new Date(
      `${anioAnterior}-${String(mesAnterior).padStart(2, '0')}-01T12:00:00`
    ).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  }, []);

  const porCobrar = useMemo(() => {
    return cotizacionesAceptadasTodas.reduce((total, cotizacion) => {
      const pagado = pagosClientesTodos
        .filter((pago) => pago.cotizacion_id === cotizacion.id)
        .reduce((subtotal, pago) => subtotal + pago.monto, 0);

      return total + Math.max(0, Number(cotizacion.total_final || 0) - pagado);
    }, 0);
  }, [cotizacionesAceptadasTodas, pagosClientesTodos]);

  const tasaAceptacion = useMemo(() => {
    if (cotizacionesMes.length === 0) {
      return 0;
    }

    return (aceptadasDeCotizacionesEmitidasMes.length / cotizacionesMes.length) * 100;
  }, [cotizacionesMes, aceptadasDeCotizacionesEmitidasMes]);

  const topClientes = useMemo(() => {
    const agrupado = new Map<string, number>();

    aceptadasMes.forEach((cotizacion) => {
      agrupado.set(
        cotizacion.cliente_razon_social,
        (agrupado.get(cotizacion.cliente_razon_social) || 0) +
          Number(cotizacion.total_final || 0)
      );
    });

    return Array.from(agrupado.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [aceptadasMes]);

  const topProductos = useMemo(() => {
    const agrupado = new Map<
      string,
      {
        cantidad: number;
        total: number;
      }
    >();

    itemsMes.forEach((item) => {
      const actual = agrupado.get(item.nombre_producto) || {
        cantidad: 0,
        total: 0,
      };

      actual.cantidad += Number(item.cantidad || 0);
      actual.total += Number(item.total_neto_linea || 0);

      agrupado.set(item.nombre_producto, actual);
    });

    return Array.from(agrupado.entries())
      .map(([nombre, datos]) => ({
        nombre,
        cantidad: datos.cantidad,
        total: datos.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [itemsMes]);

  function formatoDinero(valor: number) {
    return formatearMontoConSigno(valor);
  }

  function formatoFecha(valor: string) {
    return formatearFecha(valor);
  }

  function capitalizar(valor: string) {
    return valor.charAt(0).toUpperCase() + valor.slice(1);
  }

  if (loading) {
    return <p>Cargando dashboard...</p>;
  }

  return (
    <div className="module-page">
      <div className="dashboard-header finance-module-header">
        <div>
          <p className="eyebrow">RESUMEN GENERAL</p>
          <h1>Dashboard</h1>
          <p className="module-description">
            Vista rápida del estado comercial y financiero de la empresa.
          </p>
        </div>

        <div className="finance-header-actions">
          {esAdmin && (
            <>
              <button
                className="secondary-button"
                onClick={() => cambiarPagina('pagos')}
              >
                Registrar pago
              </button>

              <button
                className="secondary-button"
                onClick={() => cambiarPagina('gastos')}
              >
                Registrar gasto
              </button>
            </>
          )}

          <button
            className="primary-button"
            onClick={() => cambiarPagina('cotizaciones')}
          >
            + Nueva cotización
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="finance-kpi-grid finance-dashboard-kpis">
        <div className="finance-kpi-card">
          <span>Ventas del mes</span>
          <strong>{formatoDinero(ventasMes)}</strong>
          <small>Valor de cotizaciones aceptadas</small>
        </div>

        <div className="finance-kpi-card">
          <span>Cotizaciones emitidas</span>
          <strong>{cotizacionesMes.length}</strong>
          <small>Durante el mes actual</small>
        </div>

        <div className="finance-kpi-card">
          <span>Cotizaciones aceptadas</span>
          <strong>{aceptadasMes.length}</strong>
          <small>Durante el mes actual</small>
        </div>

        <div className="finance-kpi-card">
          <span>Tasa de aceptación</span>
          <strong>{tasaAceptacion.toFixed(1)}%</strong>
          <small>
            {aceptadasDeCotizacionesEmitidasMes.length} de {cotizacionesMes.length} emitidas
          </small>
        </div>

        {esAdmin && (
          <>
            <div className="finance-kpi-card">
              <span>Cobrado este mes</span>
              <strong>{formatoDinero(cobradoMes)}</strong>
              <small>Dinero realmente recibido</small>
            </div>

            <div className="finance-kpi-card">
              <span>Por cobrar total</span>
              <strong>{formatoDinero(porCobrar)}</strong>
              <small>Cotizaciones aceptadas pendientes</small>
            </div>

            <div className="finance-kpi-card">
              <span>Gastos del mes</span>
              <strong>{formatoDinero(gastosNetosMes)}</strong>
              <small>Gasto neto registrado</small>
            </div>

            <div className="finance-kpi-card">
              <span>Resultado mensual</span>
              <strong
                className={resultadoMes < 0 ? 'finance-negative' : 'finance-positive'}
              >
                {formatoDinero(resultadoMes)}
              </strong>
              <small>Vista gerencial</small>
            </div>

            <div className="finance-kpi-card">
              <span>Flujo real de {capitalizar(nombreMesActual)}</span>
              <strong
                className={flujoMes < 0 ? 'finance-negative' : 'finance-positive'}
              >
                {formatoDinero(flujoMes)}
              </strong>
              <small>Entradas menos salidas reales (neto de IVA, gastos y compras de socio)</small>
            </div>

            <div className="finance-kpi-card">
              <span>Flujo real de {capitalizar(nombreMesAnterior)}</span>
              <strong
                className={
                  flujoMesAnterior < 0 ? 'finance-negative' : 'finance-positive'
                }
              >
                {formatoDinero(flujoMesAnterior)}
              </strong>
              <small>Mismo cálculo, mes anterior</small>
            </div>

            <div className="finance-kpi-card">
              <span>IVA estimado</span>
              <strong>{formatoDinero(impuestoMes?.iva_estimado_pagar || 0)}</strong>
              <small>{impuestoMes?.estado || 'Sin período guardado'}</small>
            </div>
          </>
        )}
      </div>

      <div className="finance-dashboard-grid">
        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <p className="eyebrow">COMERCIAL</p>
              <h2>Cotizaciones recientes</h2>
            </div>

            <button
              className="finance-text-button"
              onClick={() => cambiarPagina('cotizaciones')}
            >
              Ver todas
            </button>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="right">Total</th>
                </tr>
              </thead>

              <tbody>
                {cotizacionesRecientes.map((cotizacion) => (
                  <tr key={cotizacion.id}>
                    <td>
                      <strong>{cotizacion.numero}</strong>
                    </td>
                    <td>{cotizacion.cliente_razon_social}</td>
                    <td>{formatoFecha(cotizacion.fecha)}</td>
                    <td>
                      <span
                        className={`finance-badge ${
                          cotizacion.estado === 'Aceptada'
                            ? 'finance-badge-success'
                            : cotizacion.estado === 'Rechazada'
                            ? 'finance-badge-expense'
                            : 'finance-badge-warning'
                        }`}
                      >
                        {cotizacion.estado}
                      </span>
                    </td>
                    <td className="right">
                      {formatoDinero(cotizacion.total_final)}
                    </td>
                  </tr>
                ))}

                {cotizacionesRecientes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="finance-empty">
                      No hay cotizaciones todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {esAdmin && (
          <div className="form-card">
            <div className="finance-list-header">
              <div>
                <p className="eyebrow">FINANZAS</p>
                <h2>Resumen del mes</h2>
              </div>
            </div>

            <div className="finance-compact-metrics">
              <button onClick={() => cambiarPagina('pagos')}>
                <span>Ingresos cobrados</span>
                <strong>{formatoDinero(cobradoMes)}</strong>
              </button>

              <button onClick={() => cambiarPagina('pagos')}>
                <span>Por cobrar</span>
                <strong>{formatoDinero(porCobrar)}</strong>
              </button>

              <button onClick={() => cambiarPagina('gastos')}>
                <span>Gastos pagados</span>
                <strong>{formatoDinero(gastosPagadosMes)}</strong>
              </button>

              <button onClick={() => cambiarPagina('resultados')}>
                <span>Resultado</span>
                <strong>{formatoDinero(resultadoMes)}</strong>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="finance-dashboard-grid">
        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <p className="eyebrow">TOP CLIENTES</p>
              <h2>Ventas aceptadas del mes</h2>
            </div>
          </div>

          <div className="finance-ranking">
            {topClientes.map((cliente, index) => (
              <div key={cliente.nombre}>
                <span className="finance-rank-number">{index + 1}</span>
                <span>{cliente.nombre}</span>
                <strong>{formatoDinero(cliente.total)}</strong>
              </div>
            ))}

            {topClientes.length === 0 && (
              <p className="finance-empty">Sin ventas aceptadas este mes.</p>
            )}
          </div>
        </div>

        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <p className="eyebrow">TOP PRODUCTOS</p>
              <h2>Productos vendidos del mes</h2>
            </div>
          </div>

          <div className="finance-ranking">
            {topProductos.map((producto, index) => (
              <div key={producto.nombre}>
                <span className="finance-rank-number">{index + 1}</span>
                <span>
                  {producto.nombre}
                  <small>{producto.cantidad} unidades</small>
                </span>
                <strong>{formatoDinero(producto.total)}</strong>
              </div>
            ))}

            {topProductos.length === 0 && (
              <p className="finance-empty">Sin productos vendidos este mes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
