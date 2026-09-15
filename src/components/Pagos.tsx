import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMonto, formatearFecha } from '../utils/formato';
import './Finanzas.css';

type TabPago = 'movimientos' | 'cobrar' | 'pagar';
type TipoPago = 'cliente' | 'proveedor';

type Cotizacion = {
  id: string;
  numero: string;
  fecha: string;
  estado: 'Borrador' | 'Modificada' | 'Aceptada' | 'Rechazada';
  cliente_razon_social: string;
  total_final: number;
};

type Proveedor = {
  id: string;
  razon_social: string;
};

type CotizacionItem = {
  cotizacion_id: string;
  proveedor_id: string | null;
  costo_total: number;
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

type PagoProveedor = {
  id: string;
  cotizacion_id: string | null;
  proveedor_id: string | null;
  fecha: string;
  monto: number;
  numero_documento: string | null;
  metodo_pago: string | null;
  referencia: string | null;
  observaciones: string | null;
  created_at: string;
  cotizaciones: {
    numero: string;
  } | null;
  proveedores: {
    razon_social: string;
  } | null;
};

type Movimiento = {
  id: string;
  tipo: 'Ingreso' | 'Egreso';
  fecha: string;
  relacionado: string;
  documento: string;
  metodo: string;
  referencia: string;
  monto: number;
  origen: 'cliente' | 'proveedor';
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

type PorPagar = {
  key: string;
  cotizacion_id: string;
  numero: string;
  proveedor_id: string;
  proveedor: string;
  costo: number;
  pagado: number;
  saldo: number;
};

const HOY = fechaLocalISO();

function Pagos() {
  const [tab, setTab] = useState<TabPago>('movimientos');

  const [pagosClientes, setPagosClientes] = useState<PagoCliente[]>([]);
  const [pagosProveedores, setPagosProveedores] = useState<PagoProveedor[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [itemsCotizacion, setItemsCotizacion] = useState<CotizacionItem[]>([]);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tipoPago, setTipoPago] = useState<TipoPago>('cliente');
  const [fecha, setFecha] = useState(HOY);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [referencia, setReferencia] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [cotizacionId, setCotizacionId] = useState('');
  const [proveedorId, setProveedorId] = useState('');

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

    const [
      pagosClientesResult,
      pagosProveedoresResult,
      cotizacionesResult,
      proveedoresResult,
      itemsResult,
    ] = await Promise.all([
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
        .from('pagos_proveedores')
        .select(
          `
          id,
          cotizacion_id,
          proveedor_id,
          fecha,
          monto,
          numero_documento,
          metodo_pago,
          referencia,
          observaciones,
          created_at,
          cotizaciones (
            numero
          ),
          proveedores (
            razon_social
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
        .eq('estado', 'Aceptada')
        .order('fecha', { ascending: false }),

      supabase
        .from('proveedores')
        .select('id, razon_social')
        .eq('activo', true)
        .order('razon_social'),

      supabase
        .from('cotizacion_items')
        .select('cotizacion_id, proveedor_id, costo_total'),
    ]);

    if (pagosClientesResult.error) {
      setError(pagosClientesResult.error.message);
    } else {
      setPagosClientes(
        (pagosClientesResult.data || []) as unknown as PagoCliente[]
      );
    }

    if (pagosProveedoresResult.error) {
      setError(pagosProveedoresResult.error.message);
    } else {
      setPagosProveedores(
        (pagosProveedoresResult.data || []) as unknown as PagoProveedor[]
      );
    }

    if (cotizacionesResult.error) {
      setError(cotizacionesResult.error.message);
    } else {
      setCotizaciones((cotizacionesResult.data || []) as Cotizacion[]);
    }

    if (proveedoresResult.error) {
      setError(proveedoresResult.error.message);
    } else {
      setProveedores((proveedoresResult.data || []) as Proveedor[]);
    }

    if (itemsResult.error) {
      setError(itemsResult.error.message);
    } else {
      setItemsCotizacion((itemsResult.data || []) as CotizacionItem[]);
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

  const porPagar = useMemo<PorPagar[]>(() => {
    const cotizacionesPorId = new Map<string, Cotizacion>(
      cotizaciones.map((c) => [c.id, c] as [string, Cotizacion])
    );
    const proveedoresPorId = new Map<string, string>(
      proveedores.map((p) => [p.id, p.razon_social] as [string, string])
    );

    const agrupado = new Map<
      string,
      {
        cotizacion_id: string;
        proveedor_id: string;
        costo: number;
      }
    >();

    itemsCotizacion.forEach((item) => {
      if (!item.proveedor_id || !cotizacionesPorId.has(item.cotizacion_id)) {
        return;
      }

      const key = `${item.cotizacion_id}__${item.proveedor_id}`;
      const actual = agrupado.get(key);

      if (actual) {
        actual.costo += Number(item.costo_total || 0);
      } else {
        agrupado.set(key, {
          cotizacion_id: item.cotizacion_id,
          proveedor_id: item.proveedor_id,
          costo: Number(item.costo_total || 0),
        });
      }
    });

    return Array.from(agrupado.entries())
      .map(([key, grupo]) => {
        const cotizacion = cotizacionesPorId.get(grupo.cotizacion_id);

        const pagado = pagosProveedores
          .filter(
            (pago) =>
              pago.cotizacion_id === grupo.cotizacion_id &&
              pago.proveedor_id === grupo.proveedor_id
          )
          .reduce((total, pago) => total + Number(pago.monto || 0), 0);

        return {
          key,
          cotizacion_id: grupo.cotizacion_id,
          numero: cotizacion?.numero || '',
          proveedor_id: grupo.proveedor_id,
          proveedor:
            proveedoresPorId.get(grupo.proveedor_id) || 'Proveedor sin nombre',
          costo: grupo.costo,
          pagado,
          saldo: Math.max(0, grupo.costo - pagado),
        };
      })
      .filter((fila) => fila.saldo > 0.5)
      .sort((a, b) => b.saldo - a.saldo);
  }, [cotizaciones, proveedores, itemsCotizacion, pagosProveedores]);

  const movimientos = useMemo<Movimiento[]>(() => {
    const ingresos: Movimiento[] = pagosClientes.map((pago) => ({
      id: pago.id,
      tipo: 'Ingreso',
      fecha: pago.fecha,
      relacionado: pago.cotizaciones?.cliente_razon_social || 'Cliente',
      documento: pago.cotizaciones?.numero || '',
      metodo: pago.metodo_pago || 'Sin especificar',
      referencia: pago.referencia || '',
      monto: Number(pago.monto || 0),
      origen: 'cliente',
    }));

    const egresos: Movimiento[] = pagosProveedores.map((pago) => ({
      id: pago.id,
      tipo: 'Egreso',
      fecha: pago.fecha,
      relacionado: pago.proveedores?.razon_social || 'Proveedor',
      documento:
        pago.cotizaciones?.numero || pago.numero_documento || 'Sin documento',
      metodo: pago.metodo_pago || 'Sin especificar',
      referencia: pago.referencia || '',
      monto: Number(pago.monto || 0),
      origen: 'proveedor',
    }));

    return [...ingresos, ...egresos].sort((a, b) =>
      `${b.fecha}-${b.id}`.localeCompare(`${a.fecha}-${a.id}`)
    );
  }, [pagosClientes, pagosProveedores]);

  const movimientosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) {
      return movimientos;
    }

    return movimientos.filter((movimiento) =>
      [
        movimiento.tipo,
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

  const totalEgresos = useMemo(
    () =>
      pagosProveedores.reduce(
        (total, pago) => total + Number(pago.monto || 0),
        0
      ),
    [pagosProveedores]
  );

  const totalPorCobrar = useMemo(
    () => porCobrar.reduce((total, fila) => total + fila.saldo, 0),
    [porCobrar]
  );

  const totalPorPagar = useMemo(
    () => porPagar.reduce((total, fila) => total + fila.saldo, 0),
    [porPagar]
  );

  const saldoCotizacionIngreso = useMemo(() => {
    return (
      porCobrar.find((fila) => fila.cotizacion_id === cotizacionId)?.saldo || 0
    );
  }, [porCobrar, cotizacionId]);

  const saldoProveedorSeleccionado = useMemo(() => {
    if (!cotizacionId || !proveedorId) {
      return null;
    }

    return (
      porPagar.find(
        (fila) =>
          fila.cotizacion_id === cotizacionId &&
          fila.proveedor_id === proveedorId
      )?.saldo ?? 0
    );
  }, [porPagar, cotizacionId, proveedorId]);

  const proveedoresCotizacionSeleccionada = useMemo(() => {
    if (!cotizacionId) {
      return proveedores;
    }

    const ids = new Set(
      itemsCotizacion
        .filter((item) => item.cotizacion_id === cotizacionId)
        .map((item) => item.proveedor_id)
        .filter(Boolean) as string[]
    );

    return proveedores.filter((proveedor) => ids.has(proveedor.id));
  }, [cotizacionId, itemsCotizacion, proveedores]);

  function abrirFormulario(tipo: TipoPago) {
    setTipoPago(tipo);
    setFecha(HOY);
    setMonto('');
    setMetodoPago('Transferencia');
    setReferencia('');
    setNumeroDocumento('');
    setObservaciones('');
    setCotizacionId('');
    setProveedorId('');
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

    if (tipoPago === 'cliente' && !cotizacionId) {
      setError('Debes seleccionar una cotización.');
      return;
    }

    if (
      tipoPago === 'cliente' &&
      saldoCotizacionIngreso > 0 &&
      montoNumero > saldoCotizacionIngreso + 0.5
    ) {
      setError(
        `El monto supera el saldo pendiente de ${formatoDinero(
          saldoCotizacionIngreso
        )}.`
      );
      return;
    }

    if (tipoPago === 'proveedor' && !proveedorId) {
      setError('Debes seleccionar un proveedor.');
      return;
    }

    if (
      tipoPago === 'proveedor' &&
      cotizacionId &&
      saldoProveedorSeleccionado !== null &&
      montoNumero > saldoProveedorSeleccionado + 0.5
    ) {
      setError(
        `El monto supera el saldo pendiente con este proveedor de ${formatoDinero(
          saldoProveedorSeleccionado
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

    if (tipoPago === 'cliente') {
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
    } else {
      const { error } = await supabase.from('pagos_proveedores').insert({
        cotizacion_id: cotizacionId || null,
        proveedor_id: proveedorId,
        fecha,
        monto: montoNumero,
        numero_documento: numeroDocumento.trim() || null,
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
    }

    await cargarDatos();

    setGuardando(false);
    setMostrarFormulario(false);
    setMensaje('Pago registrado correctamente.');
  }

  async function eliminarMovimiento(movimiento: Movimiento) {
    const confirmado = window.confirm(
      `¿Eliminar este ${movimiento.tipo.toLowerCase()} por ${formatoDinero(
        movimiento.monto
      )}?`
    );

    if (!confirmado) {
      return;
    }

    const tabla =
      movimiento.origen === 'cliente' ? 'pagos_clientes' : 'pagos_proveedores';

    const { error } = await supabase
      .from(tabla)
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
    abrirFormulario('cliente');
    setCotizacionId(fila.cotizacion_id);
    setMonto(String(Math.round(fila.saldo)));
  }

  function registrarPagoProveedor(fila: PorPagar) {
    abrirFormulario('proveedor');
    setCotizacionId(fila.cotizacion_id);
    setProveedorId(fila.proveedor_id);
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
          <h1>Pagos</h1>
          <p className="module-description">
            Control de ingresos recibidos, pagos a proveedores y saldos
            pendientes.
          </p>
        </div>

        <div className="finance-header-actions">
          <button
            className="secondary-button"
            onClick={() => abrirFormulario('proveedor')}
          >
            Registrar egreso
          </button>

          <button
            className="primary-button"
            onClick={() => abrirFormulario('cliente')}
          >
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
          <span>Pagos a proveedores</span>
          <strong>{formatoDinero(totalEgresos)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>Por cobrar</span>
          <strong>{formatoDinero(totalPorCobrar)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>Por pagar productos</span>
          <strong>{formatoDinero(totalPorPagar)}</strong>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="form-card finance-form-card">
          <div className="finance-form-title">
            <div>
              <p className="eyebrow">NUEVO MOVIMIENTO</p>
              <h2>
                {tipoPago === 'cliente'
                  ? 'Pago recibido de cliente'
                  : 'Pago realizado a proveedor'}
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

          <form onSubmit={guardarPago}>
            <div className="finance-type-selector">
              <button
                type="button"
                className={tipoPago === 'cliente' ? 'active' : ''}
                onClick={() => {
                  setTipoPago('cliente');
                  setCotizacionId('');
                  setProveedorId('');
                }}
              >
                Ingreso de cliente
              </button>

              <button
                type="button"
                className={tipoPago === 'proveedor' ? 'active' : ''}
                onClick={() => {
                  setTipoPago('proveedor');
                  setCotizacionId('');
                  setProveedorId('');
                }}
              >
                Pago a proveedor
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

              {tipoPago === 'cliente' ? (
                <label className="full-width">
                  Cotización *
                  <select
                    value={cotizacionId}
                    onChange={(event) => setCotizacionId(event.target.value)}
                    required
                  >
                    <option value="">Seleccionar cotización</option>

                    {porCobrar.map((fila) => (
                      <option
                        key={fila.cotizacion_id}
                        value={fila.cotizacion_id}
                      >
                        {fila.numero} · {fila.cliente} · saldo{' '}
                        {formatoDinero(fila.saldo)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Cotización relacionada
                    <select
                      value={cotizacionId}
                      onChange={(event) => {
                        setCotizacionId(event.target.value);
                        setProveedorId('');
                      }}
                    >
                      <option value="">Sin cotización</option>

                      {cotizaciones.map((cotizacion) => (
                        <option key={cotizacion.id} value={cotizacion.id}>
                          {cotizacion.numero} ·{' '}
                          {cotizacion.cliente_razon_social}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Proveedor *
                    <select
                      value={proveedorId}
                      onChange={(event) => setProveedorId(event.target.value)}
                      required
                    >
                      <option value="">Seleccionar proveedor</option>

                      {proveedoresCotizacionSeleccionada.map((proveedor) => (
                        <option key={proveedor.id} value={proveedor.id}>
                          {proveedor.razon_social}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

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

              {tipoPago === 'proveedor' && (
                <label>
                  N° documento
                  <input
                    value={numeroDocumento}
                    onChange={(event) => setNumeroDocumento(event.target.value)}
                    placeholder="Factura, boleta, OC..."
                  />
                </label>
              )}

              <label className={tipoPago === 'cliente' ? '' : 'full-width'}>
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

            {tipoPago === 'cliente' && cotizacionId && (
              <div className="finance-inline-note">
                Saldo pendiente actual:{' '}
                <strong>{formatoDinero(saldoCotizacionIngreso)}</strong>
              </div>
            )}

            {tipoPago === 'proveedor' &&
              cotizacionId &&
              proveedorId &&
              saldoProveedorSeleccionado !== null && (
                <div className="finance-inline-note">
                  Saldo pendiente con este proveedor:{' '}
                  <strong>{formatoDinero(saldoProveedorSeleccionado)}</strong>
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

        <button
          className={tab === 'pagar' ? 'active' : ''}
          onClick={() => setTab('pagar')}
        >
          Por pagar
          {porPagar.length > 0 && <span>{porPagar.length}</span>}
        </button>
      </div>

      {tab === 'movimientos' && (
        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <h2>Movimientos</h2>
              <p className="module-description">
                Cada fila representa dinero que efectivamente entró o salió.
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
                  <th>Tipo</th>
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
                  <tr key={`${movimiento.origen}-${movimiento.id}`}>
                    <td>{formatoFecha(movimiento.fecha)}</td>
                    <td>
                      <span
                        className={`finance-badge ${
                          movimiento.tipo === 'Ingreso'
                            ? 'finance-badge-success'
                            : 'finance-badge-expense'
                        }`}
                      >
                        {movimiento.tipo}
                      </span>
                    </td>
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
                    <td colSpan={8} className="finance-empty">
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

      {tab === 'pagar' && (
        <div className="form-card">
          <div className="finance-list-header">
            <div>
              <h2>Cuentas por pagar</h2>
              <p className="module-description">
                Costos de proveedor asociados a cotizaciones aceptadas.
              </p>
            </div>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Proveedor</th>
                  <th className="right">Costo</th>
                  <th className="right">Pagado</th>
                  <th className="right">Pendiente</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {porPagar.map((fila) => (
                  <tr key={fila.key}>
                    <td>
                      <strong>{fila.numero}</strong>
                    </td>
                    <td>{fila.proveedor}</td>
                    <td className="right">{formatoDinero(fila.costo)}</td>
                    <td className="right">{formatoDinero(fila.pagado)}</td>
                    <td className="right">
                      <strong>{formatoDinero(fila.saldo)}</strong>
                    </td>
                    <td className="right">
                      <button
                        className="finance-text-button"
                        onClick={() => registrarPagoProveedor(fila)}
                      >
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                ))}

                {porPagar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="finance-empty">
                      No hay costos de producto pendientes de pago.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="finance-footnote">
            Esta vista usa el costo neto guardado en los ítems de las
            cotizaciones. Los gastos administrativos se controlan en el módulo
            Gastos.
          </p>
        </div>
      )}
    </div>
  );
}

export default Pagos;
