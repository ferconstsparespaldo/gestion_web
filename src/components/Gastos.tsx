import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMonto, formatearFecha } from '../utils/formato';
import './Finanzas.css';

type Categoria = {
  id: string;
  nombre: string;
};

type Proveedor = {
  id: string;
  razon_social: string;
};

type TipoGasto = 'Operacional' | 'Socio';

type Gasto = {
  id: string;
  fecha: string;
  categoria_id: string | null;
  descripcion: string | null;
  proveedor_receptor: string | null;
  monto_neto: number;
  iva: number;
  monto_liquido: number;
  considera_iva_credito: boolean;
  tipo: TipoGasto;
  estado_pago: 'Pendiente' | 'Parcial' | 'Pagado';
  fecha_pago: string | null;
  metodo_pago: string | null;
  numero_documento: string | null;
  comprobante_url: string | null;
  observaciones: string | null;
  categorias_gasto:
    | {
        nombre: string;
      }
    | null;
};

const HOY = fechaLocalISO();
const MES_ACTUAL = HOY.slice(0, 7);

function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [ivaPorcentaje, setIvaPorcentaje] = useState(19);

  const [mes, setMes] = useState(MES_ACTUAL);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | TipoGasto>('Todos');
  const [busqueda, setBusqueda] = useState('');

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tipo, setTipo] = useState<TipoGasto>('Operacional');
  const [fecha, setFecha] = useState(HOY);
  const [categoriaId, setCategoriaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [proveedorReceptor, setProveedorReceptor] = useState('');
  const [montoNeto, setMontoNeto] = useState('');
  const [iva, setIva] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [consideraIvaCredito, setConsideraIvaCredito] = useState(true);
  const [estadoPago, setEstadoPago] = useState<'Pendiente' | 'Pagado'>('Pendiente');
  const [fechaPago, setFechaPago] = useState(HOY);
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [mostrarNuevaCategoria, setMostrarNuevaCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');

  const [marcandoPagoId, setMarcandoPagoId] = useState<string | null>(null);
  const [fechaPagoConfirmar, setFechaPagoConfirmar] = useState(HOY);

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

    const [gastosResult, categoriasResult, proveedoresResult, configResult] =
      await Promise.all([
        supabase
          .from('gastos')
          .select(
            `
            id,
            fecha,
            categoria_id,
            descripcion,
            proveedor_receptor,
            monto_neto,
            iva,
            monto_liquido,
            considera_iva_credito,
            tipo,
            estado_pago,
            fecha_pago,
            metodo_pago,
            numero_documento,
            comprobante_url,
            observaciones,
            categorias_gasto (
              nombre
            )
          `
          )
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('categorias_gasto')
          .select('id, nombre')
          .eq('activo', true)
          .order('nombre'),

        supabase
          .from('proveedores')
          .select('id, razon_social')
          .eq('activo', true)
          .order('razon_social'),

        supabase
          .from('configuracion_empresa')
          .select('iva_porcentaje')
          .limit(1)
          .maybeSingle(),
      ]);

    if (gastosResult.error) {
      setError(gastosResult.error.message);
    } else {
      setGastos((gastosResult.data || []) as unknown as Gasto[]);
    }

    if (categoriasResult.error) {
      setError(categoriasResult.error.message);
    } else {
      setCategorias((categoriasResult.data || []) as Categoria[]);
    }

    if (proveedoresResult.error) {
      setError(proveedoresResult.error.message);
    } else {
      setProveedores((proveedoresResult.data || []) as Proveedor[]);
    }

    if (!configResult.error && configResult.data) {
      setIvaPorcentaje(Number(configResult.data.iva_porcentaje ?? 19));
    }

    setLoading(false);
  }

  const gastosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return gastos.filter((gasto) => {
      const coincideMes = !mes || gasto.fecha.startsWith(mes);
      const coincideCategoria =
        filtroCategoria === 'Todas' ||
        gasto.categoria_id === filtroCategoria;
      const coincideTipo = filtroTipo === 'Todos' || gasto.tipo === filtroTipo;

      const coincideBusqueda =
        !termino ||
        [
          gasto.descripcion || '',
          gasto.proveedor_receptor || '',
          gasto.numero_documento || '',
          gasto.categorias_gasto?.nombre || '',
          gasto.observaciones || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(termino);

      return coincideMes && coincideCategoria && coincideTipo && coincideBusqueda;
    });
  }, [gastos, mes, filtroCategoria, filtroTipo, busqueda]);

  const resumen = useMemo(() => {
    return gastosFiltrados
      .filter((gasto) => gasto.tipo !== 'Socio')
      .reduce(
        (acumulado, gasto) => {
          acumulado.neto += Number(gasto.monto_neto || 0);
          acumulado.iva += Number(gasto.iva || 0);
          acumulado.total += Number(gasto.monto_liquido || 0);

          if (gasto.estado_pago === 'Pagado') {
            acumulado.pagado += Number(gasto.monto_liquido || 0);
          } else {
            acumulado.pendiente += Number(gasto.monto_liquido || 0);
          }

          return acumulado;
        },
        {
          neto: 0,
          iva: 0,
          total: 0,
          pagado: 0,
          pendiente: 0,
        }
      );
  }, [gastosFiltrados]);

  const ivaCreditoSocios = useMemo(
    () =>
      gastosFiltrados
        .filter((gasto) => gasto.tipo === 'Socio')
        .reduce((total, gasto) => total + Number(gasto.iva || 0), 0),
    [gastosFiltrados]
  );

  function abrirFormulario() {
    setTipo('Operacional');
    setFecha(HOY);
    setCategoriaId('');
    setDescripcion('');
    setProveedorReceptor('');
    setMontoNeto('');
    setIva('');
    setMontoTotal('');
    setConsideraIvaCredito(true);
    setEstadoPago('Pendiente');
    setFechaPago(HOY);
    setMetodoPago('Transferencia');
    setNumeroDocumento('');
    setObservaciones('');
    setMostrarNuevaCategoria(false);
    setNuevaCategoria('');
    setError('');
    setMensaje('');
    setMostrarFormulario(true);
  }

  function cambiarNeto(valor: string) {
    setMontoNeto(valor);

    const neto = Number(valor || 0);

    if (!valor) {
      setIva('');
      setMontoTotal('');
      return;
    }

    const ivaCalculado = Math.round(neto * (ivaPorcentaje / 100));
    const totalCalculado = neto + ivaCalculado;

    setIva(String(ivaCalculado));
    setMontoTotal(String(totalCalculado));
  }

  function cambiarTotal(valor: string) {
    setMontoTotal(valor);

    const total = Number(valor || 0);

    if (!valor) {
      setMontoNeto('');
      setIva('');
      return;
    }

    const netoCalculado = Math.round(total / (1 + ivaPorcentaje / 100));
    const ivaCalculado = total - netoCalculado;

    setMontoNeto(String(netoCalculado));
    setIva(String(ivaCalculado));
  }

  async function crearCategoria() {
    const nombre = nuevaCategoria.trim();

    if (!nombre) {
      setError('Escribe un nombre para la categoría.');
      return;
    }

    const { data, error } = await supabase
      .from('categorias_gasto')
      .insert({
        nombre,
      })
      .select('id, nombre')
      .single();

    if (error || !data) {
      setError(error?.message || 'No se pudo crear la categoría.');
      return;
    }

    setCategorias((actuales) =>
      [...actuales, data as Categoria].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es')
      )
    );

    setCategoriaId(data.id);
    setNuevaCategoria('');
    setMostrarNuevaCategoria(false);
    setMensaje('Categoría creada.');
  }

  async function guardarGasto(event: React.FormEvent) {
    event.preventDefault();

    const netoNumero = Number(montoNeto || 0);
    const ivaNumero = Number(iva || 0);
    const totalNumero = Number(montoTotal || 0);

    if (totalNumero <= 0) {
      setError('Debes ingresar el neto o el total del gasto.');
      return;
    }

    if (tipo === 'Operacional' && estadoPago === 'Pagado' && !fechaPago) {
      setError('Debes indicar la fecha en que se pagó el gasto.');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const esSocio = tipo === 'Socio';

    const { error } = await supabase.from('gastos').insert({
      fecha,
      categoria_id: categoriaId || null,
      descripcion: descripcion.trim() || null,
      proveedor_receptor: proveedorReceptor.trim() || null,
      monto_neto: netoNumero,
      iva: ivaNumero,
      monto_liquido: totalNumero,
      considera_iva_credito: esSocio ? true : consideraIvaCredito,
      tipo,
      estado_pago: esSocio ? 'Pagado' : estadoPago,
      fecha_pago:
        !esSocio && estadoPago === 'Pagado' ? fechaPago || null : null,
      metodo_pago: esSocio ? null : estadoPago === 'Pagado' ? metodoPago || null : null,
      numero_documento: numeroDocumento.trim() || null,
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
    setMensaje('Gasto registrado correctamente.');
  }

  async function cambiarEstadoGasto(
    gasto: Gasto,
    nuevoEstado: 'Pendiente' | 'Pagado',
    fechaPagoReal?: string
  ) {
    const actualizacion: Record<string, string | null> = {
      estado_pago: nuevoEstado,
    };

    if (nuevoEstado === 'Pagado') {
      actualizacion.fecha_pago = fechaPagoReal || HOY;

      if (!gasto.metodo_pago) {
        actualizacion.metodo_pago = 'Transferencia';
      }
    } else {
      actualizacion.fecha_pago = null;
    }

    const { error } = await supabase
      .from('gastos')
      .update(actualizacion)
      .eq('id', gasto.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMensaje(
      nuevoEstado === 'Pagado'
        ? 'Gasto marcado como pagado.'
        : 'Gasto marcado como pendiente.'
    );

    await cargarDatos();
  }

  function iniciarMarcarPagado(gasto: Gasto) {
    setMarcandoPagoId(gasto.id);
    setFechaPagoConfirmar(HOY);
  }

  async function confirmarMarcarPagado(gasto: Gasto) {
    if (!fechaPagoConfirmar) {
      setError('Debes indicar la fecha en que se pagó el gasto.');
      return;
    }

    await cambiarEstadoGasto(gasto, 'Pagado', fechaPagoConfirmar);
    setMarcandoPagoId(null);
  }

  async function eliminarGasto(gasto: Gasto) {
    const confirmado = window.confirm(
      `¿Eliminar el gasto por ${formatoDinero(gasto.monto_liquido)}?`
    );

    if (!confirmado) {
      return;
    }

    const { error } = await supabase.from('gastos').delete().eq('id', gasto.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMensaje('Gasto eliminado.');
    await cargarDatos();
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
    return <p>Cargando gastos...</p>;
  }

  return (
    <div className="module-page">
      <div className="module-header finance-module-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Gastos</h1>
          <p className="module-description">
            Gastos operacionales y administrativos que no corresponden al costo
            directo de los productos cotizados.
          </p>
        </div>

        <button className="primary-button" onClick={abrirFormulario}>
          + Nuevo gasto
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {mensaje && <div className="success-message">{mensaje}</div>}

      <div className="finance-kpi-grid">
        <div className="finance-kpi-card">
          <span>Neto</span>
          <strong>{formatoDinero(resumen.neto)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>IVA</span>
          <strong>{formatoDinero(resumen.iva)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>Total gastos</span>
          <strong>{formatoDinero(resumen.total)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>Pendiente de pago</span>
          <strong>{formatoDinero(resumen.pendiente)}</strong>
        </div>

        <div className="finance-kpi-card">
          <span>IVA crédito compras socio</span>
          <strong>{formatoDinero(ivaCreditoSocios)}</strong>
          <small>No es gasto de la empresa</small>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="form-card finance-form-card">
          <div className="finance-form-title">
            <div>
              <p className="eyebrow">NUEVO REGISTRO</p>
              <h2>Nuevo gasto</h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setMostrarFormulario(false)}
            >
              Cerrar
            </button>
          </div>

          <div className="finance-type-selector">
            <button
              type="button"
              className={tipo === 'Operacional' ? 'active' : ''}
              onClick={() => setTipo('Operacional')}
            >
              Gasto de la empresa
            </button>

            <button
              type="button"
              className={tipo === 'Socio' ? 'active' : ''}
              onClick={() => setTipo('Socio')}
            >
              Compra de socio (solo IVA)
            </button>
          </div>

          {tipo === 'Socio' && (
            <div className="finance-inline-note">
              Este registro no se cuenta como gasto de la empresa ni afecta el
              flujo de caja. Solo aporta el IVA del documento como crédito
              fiscal estimado.
            </div>
          )}

          <form onSubmit={guardarGasto}>
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
                Categoría
                <div className="finance-input-action">
                  <select
                    value={categoriaId}
                    onChange={(event) => setCategoriaId(event.target.value)}
                  >
                    <option value="">Sin categoría</option>

                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="finance-mini-button"
                    onClick={() =>
                      setMostrarNuevaCategoria((actual) => !actual)
                    }
                    title="Nueva categoría"
                  >
                    +
                  </button>
                </div>
              </label>

              {mostrarNuevaCategoria && (
                <div className="full-width finance-new-category">
                  <input
                    value={nuevaCategoria}
                    onChange={(event) => setNuevaCategoria(event.target.value)}
                    placeholder="Nombre de la nueva categoría"
                  />

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={crearCategoria}
                  >
                    Crear categoría
                  </button>
                </div>
              )}

              <label className="full-width">
                Descripción
                <input
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  placeholder="Ej: Combustible, herramientas, arriendo..."
                />
              </label>

              <label className="full-width">
                Proveedor / receptor
                <input
                  list="lista-proveedores-gastos"
                  value={proveedorReceptor}
                  onChange={(event) => setProveedorReceptor(event.target.value)}
                  placeholder="Selecciona o escribe un nombre"
                />

                <datalist id="lista-proveedores-gastos">
                  {proveedores.map((proveedor) => (
                    <option
                      key={proveedor.id}
                      value={proveedor.razon_social}
                    />
                  ))}
                </datalist>
              </label>

              <label>
                Neto
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={montoNeto}
                  onChange={(event) => cambiarNeto(event.target.value)}
                  placeholder="Puedes escribir el neto"
                />
              </label>

              <label>
                IVA {ivaPorcentaje}%
                <input type="number" value={iva} readOnly />
              </label>

              <label>
                Total pagado / por pagar
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={montoTotal}
                  onChange={(event) => cambiarTotal(event.target.value)}
                  placeholder="O escribe el total"
                />
              </label>

              {tipo === 'Operacional' && (
                <label>
                  Estado
                  <select
                    value={estadoPago}
                    onChange={(event) =>
                      setEstadoPago(
                        event.target.value as 'Pendiente' | 'Pagado'
                      )
                    }
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Pagado">Pagado</option>
                  </select>
                </label>
              )}

              {tipo === 'Operacional' && estadoPago === 'Pagado' && (
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

              {tipo === 'Operacional' && estadoPago === 'Pagado' && (
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
              )}

              <label>
                N° documento
                <input
                  value={numeroDocumento}
                  onChange={(event) => setNumeroDocumento(event.target.value)}
                  placeholder="Factura, boleta..."
                />
              </label>

              {tipo === 'Operacional' && (
                <label className="finance-checkbox-row">
                  <input
                    type="checkbox"
                    checked={consideraIvaCredito}
                    onChange={(event) =>
                      setConsideraIvaCredito(event.target.checked)
                    }
                  />
                  Considerar este IVA como crédito fiscal estimado
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
              Puedes escribir <strong>el neto o el total</strong>. El sistema
              calcula automáticamente el otro valor usando IVA{' '}
              {ivaPorcentaje}%. La <strong>fecha</strong> es la del documento;
              la <strong>fecha de pago</strong> es cuando realmente sale el
              dinero y es la que se usa para el flujo de caja real.
            </div>

            <div className="finance-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setMostrarFormulario(false)}
              >
                Cancelar
              </button>

              <button className="primary-button" type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar gasto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="form-card">
        <div className="finance-list-header">
          <div>
            <h2>Listado de gastos</h2>
            <p className="module-description">
              Los filtros también actualizan los totales superiores.
            </p>
          </div>

          <div className="finance-filters">
            <input
              type="month"
              value={mes}
              onChange={(event) => setMes(event.target.value)}
            />

            <select
              value={filtroCategoria}
              onChange={(event) => setFiltroCategoria(event.target.value)}
            >
              <option value="Todas">Todas las categorías</option>

              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroTipo}
              onChange={(event) =>
                setFiltroTipo(event.target.value as 'Todos' | TipoGasto)
              }
            >
              <option value="Todos">Empresa y socio</option>
              <option value="Operacional">Solo gastos empresa</option>
              <option value="Socio">Solo compras socio</option>
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
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Proveedor</th>
                <th>Documento</th>
                <th className="right">Neto</th>
                <th className="right">IVA</th>
                <th className="right">Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {gastosFiltrados.map((gasto) => (
                <tr key={gasto.id}>
                  <td>{formatoFecha(gasto.fecha)}</td>
                  <td>
                    <span
                      className={`finance-badge ${
                        gasto.tipo === 'Socio'
                          ? 'finance-badge-warning'
                          : 'finance-badge-success'
                      }`}
                    >
                      {gasto.tipo === 'Socio' ? 'Socio (IVA)' : 'Empresa'}
                    </span>
                  </td>
                  <td>{gasto.categorias_gasto?.nombre || '—'}</td>
                  <td>{gasto.descripcion || '—'}</td>
                  <td>{gasto.proveedor_receptor || '—'}</td>
                  <td>{gasto.numero_documento || '—'}</td>
                  <td className="right">{formatoDinero(gasto.monto_neto)}</td>
                  <td className="right">{formatoDinero(gasto.iva)}</td>
                  <td className="right">
                    <strong>{formatoDinero(gasto.monto_liquido)}</strong>
                  </td>
                  <td>
                    {gasto.tipo === 'Socio' ? (
                      <span className="finance-badge finance-badge-success">
                        No aplica
                      </span>
                    ) : marcandoPagoId === gasto.id ? (
                      <div className="finance-input-action">
                        <input
                          type="date"
                          value={fechaPagoConfirmar}
                          onChange={(event) =>
                            setFechaPagoConfirmar(event.target.value)
                          }
                        />

                        <button
                          type="button"
                          className="finance-mini-button"
                          title="Confirmar fecha de pago"
                          onClick={() => confirmarMarcarPagado(gasto)}
                        >
                          ✓
                        </button>

                        <button
                          type="button"
                          className="finance-mini-button"
                          title="Cancelar"
                          onClick={() => setMarcandoPagoId(null)}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        className={`finance-status-button ${
                          gasto.estado_pago === 'Pagado' ? 'paid' : ''
                        }`}
                        onClick={() =>
                          gasto.estado_pago === 'Pagado'
                            ? cambiarEstadoGasto(gasto, 'Pendiente')
                            : iniciarMarcarPagado(gasto)
                        }
                      >
                        {gasto.estado_pago === 'Pagado'
                          ? `Pagado · ${formatoFecha(
                              gasto.fecha_pago || gasto.fecha
                            )}`
                          : 'Pendiente'}
                      </button>
                    )}
                  </td>
                  <td className="right">
                    <button
                      className="finance-text-button danger"
                      onClick={() => eliminarGasto(gasto)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {gastosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={11} className="finance-empty">
                    No hay gastos para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="finance-footnote">
          Las compras de socio no se contabilizan como gasto de la empresa ni
          afectan el resultado o el flujo de caja: solo aportan el IVA del
          documento al crédito fiscal estimado del período (ver módulo
          Impuestos). En esta versión, los gastos marcados como “Pagado” se
          consideran salida real de caja. El estado “Parcial” queda reservado
          para una etapa posterior, cuando se agreguen abonos a gastos.
        </p>
      </div>
    </div>
  );
}

export default Gastos;
