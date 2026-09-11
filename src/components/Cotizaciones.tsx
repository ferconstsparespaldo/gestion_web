import { useEffect, useMemo, useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';

import { supabase } from '../lib/supabase';
import { fechaLocalISO } from '../utils/fecha';
import { formatearMonto, LOCALE } from '../utils/formato';
import { useEmpresa } from '../context/EmpresaContext';

type CotizacionesProps = {
  esAdmin: boolean;
};

type Cliente = {
  id: string;
  razon_social: string;
  rut: string | null;
  direccion: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
};

type Proveedor = {
  razon_social: string;
};

type Sector = {
  id: string;
  nombre: string;
};

type ProductoProveedor = {
  id: string;
  proveedor_id: string;
  precio_neto_actual: number;
  beneficio_sugerido: number;
  proveedores: Proveedor | null;
};

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  producto_proveedor: ProductoProveedor[];
};

type ItemCotizacion = {
  tempId: string;

  producto_id: string;
  proveedor_id: string;

  nombre_producto: string;
  descripcion: string;

  precio_neto_proveedor: number;
  beneficio_unitario: number;
  precio_neto_venta: number;

  cantidad: number;
};

type EstadoCotizacion = 'Borrador' | 'Modificada' | 'Aceptada' | 'Rechazada';

type CotizacionListado = {
  id: string;
  numero: string;
  fecha: string;

  estado: EstadoCotizacion;

  cliente_razon_social: string;

  neto_total: number;
  iva: number;
  total_final: number;
};

const ANCHO_CARTA_PX = 816;
const ALTO_CARTA_PX = 1056;

function itemVacio(): ItemCotizacion {
  return {
    tempId: crypto.randomUUID(),

    producto_id: '',
    proveedor_id: '',

    nombre_producto: '',
    descripcion: '',

    precio_neto_proveedor: 0,
    beneficio_unitario: 0,
    precio_neto_venta: 0,

    cantidad: 1,
  };
}

function Cotizaciones({ esAdmin }: CotizacionesProps) {
  const [cotizaciones, setCotizaciones] = useState<CotizacionListado[]>([]);

  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [productos, setProductos] = useState<Producto[]>([]);

  const [sectores, setSectores] = useState<Sector[]>([]);

  const { empresa } = useEmpresa();
  const ivaPorcentaje = empresa.ivaPorcentaje;

  const [busqueda, setBusqueda] = useState('');

  const [filtroEstado, setFiltroEstado] = useState('Todos');

  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [mostrarPreview, setMostrarPreview] = useState(false);

  const [cotizacionId, setCotizacionId] = useState<string | null>(null);

  const [numero, setNumero] = useState('');

  const [fecha, setFecha] = useState(fechaLocalISO());

  const [estado, setEstado] = useState<EstadoCotizacion>('Borrador');

  const [fechaFactura, setFechaFactura] = useState('');
  const [guardandoFechaFactura, setGuardandoFechaFactura] = useState(false);

  const [clienteId, setClienteId] = useState('');

  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<Cliente | null>(null);

  const [sectorId, setSectorId] = useState('');
  const [sectorNombre, setSectorNombre] = useState('');
  const [numeroOrden, setNumeroOrden] = useState('');

  const [fechaTrabajoInicio, setFechaTrabajoInicio] = useState(
    fechaLocalISO()
  );
  const [fechaTrabajoTermino, setFechaTrabajoTermino] = useState('');

  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [horasTrabajadas, setHorasTrabajadas] = useState(0);
  const [numTrabajadores, setNumTrabajadores] = useState(0);
  const [valorHora, setValorHora] = useState(0);

  const [vigenciaDias, setVigenciaDias] = useState(
    empresa.vigenciaCotizacionDias
  );

  const [items, setItems] = useState<ItemCotizacion[]>([itemVacio()]);

  const [despachoNeto, setDespachoNeto] = useState(0);

  const [descuentoNeto, setDescuentoNeto] = useState(0);

  const [observaciones, setObservaciones] = useState('');

  const [loading, setLoading] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [generandoPDF, setGenerandoPDF] = useState(false);

  const [error, setError] = useState('');
  const [mensajeEstado, setMensajeEstado] = useState('');
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  // La vista previa usa exactamente la misma hoja de 816 px que se exporta a PDF.
  // En pantallas angostas solo se escala visualmente; nunca cambia la distribución.
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewPageRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPageHeight, setPreviewPageHeight] = useState(ALTO_CARTA_PX);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (!mostrarPreview) {
      return;
    }

    const viewport = previewViewportRef.current;
    const pagina = previewPageRef.current;

    if (!viewport || !pagina) {
      return;
    }

    const recalcularPreview = () => {
      const anchoDisponible = Math.max(1, viewport.clientWidth - 16);
      const nuevaEscala = Math.min(1, anchoDisponible / ANCHO_CARTA_PX);

      setPreviewScale(nuevaEscala);
      setPreviewPageHeight(Math.max(ALTO_CARTA_PX, pagina.scrollHeight));
    };

    requestAnimationFrame(() => requestAnimationFrame(recalcularPreview));

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(recalcularPreview)
        : null;

    observer?.observe(viewport);
    observer?.observe(pagina);

    const imagenes = Array.from(
      pagina.querySelectorAll<HTMLImageElement>('img')
    );
    imagenes.forEach((imagen) => {
      imagen.addEventListener('load', recalcularPreview);
      imagen.addEventListener('error', recalcularPreview);
    });

    window.addEventListener('resize', recalcularPreview);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', recalcularPreview);

      imagenes.forEach((imagen) => {
        imagen.removeEventListener('load', recalcularPreview);
        imagen.removeEventListener('error', recalcularPreview);
      });
    };
  }, [mostrarPreview, items.length, observaciones]);

  async function cargarDatosIniciales() {
    setLoading(true);
    setError('');

    const [cotizacionesResult, clientesResult, sectoresResult, productosResult] =
      await Promise.all([
        supabase
          .from('cotizaciones')
          .select(
            `
            id,
            numero,
            fecha,
            estado,
            cliente_razon_social,
            neto_total,
            iva,
            total_final
          `
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('clientes')
          .select(
            `
            id,
            razon_social,
            rut,
            direccion,
            contacto,
            telefono,
            correo
          `
          )
          .eq('activo', true)
          .order('razon_social'),

        supabase
          .from('sectores')
          .select('id, nombre')
          .eq('activo', true)
          .order('nombre'),

        supabase
          .from('productos')
          .select(
            `
            id,
            nombre,
            descripcion,
            producto_proveedor (
              id,
              proveedor_id,
              precio_neto_actual,
              beneficio_sugerido,
              proveedores (
                razon_social
              )
            )
          `
          )
          .eq('activo', true)
          .order('nombre'),
      ]);

    if (cotizacionesResult.error) {
      setError(cotizacionesResult.error.message);
    } else {
      setCotizaciones((cotizacionesResult.data || []) as CotizacionListado[]);
    }

    if (clientesResult.error) {
      setError(clientesResult.error.message);
    } else {
      setClientes((clientesResult.data || []) as Cliente[]);
    }

    if (sectoresResult.error) {
      setError(sectoresResult.error.message);
    } else {
      setSectores((sectoresResult.data || []) as Sector[]);
    }

    if (productosResult.error) {
      setError(productosResult.error.message);
    } else {
      setProductos((productosResult.data || []) as unknown as Producto[]);
    }

    setLoading(false);
  }

  async function generarNumeroCotizacion(): Promise<string | null> {
    const anio = Number(fechaLocalISO().slice(0, 4));

    const { data, error } = await supabase.rpc('reservar_numero_cotizacion', {
      p_prefijo: empresa.prefijoCotizacion,
      p_anio: anio,
    });

    if (error || !data) {
      setError(
        error?.message || 'No se pudo generar un número de cotización seguro.'
      );
      return null;
    }

    return String(data);
  }

  async function nuevaCotizacion() {
    setError('');
    const nuevoNumero = await generarNumeroCotizacion();

    if (!nuevoNumero) {
      return;
    }

    setCotizacionId(null);

    setNumero(nuevoNumero);

    setFecha(fechaLocalISO());

    setEstado('Borrador');

    setFechaFactura('');

    setClienteId('');
    setClienteSeleccionado(null);

    setSectorId('');
    setSectorNombre('');
    setNumeroOrden('');

    setFechaTrabajoInicio(fechaLocalISO());
    setFechaTrabajoTermino('');

    setHoraDesde('');
    setHoraHasta('');
    setHorasTrabajadas(0);
    setNumTrabajadores(empresa.numTrabajadoresDefecto);
    setValorHora(empresa.valorHoraDefecto);

    setVigenciaDias(empresa.vigenciaCotizacionDias);

    setItems([itemVacio()]);

    setDespachoNeto(0);
    setDescuentoNeto(0);

    setObservaciones('');

    setMostrarFormulario(true);

    setMostrarPreview(false);

    setError('');
  }

  function seleccionarCliente(id: string) {
    setClienteId(id);

    const cliente = clientes.find((cliente) => cliente.id === id) || null;

    setClienteSeleccionado(cliente);
  }

  function seleccionarSector(id: string) {
    setSectorId(id);

    const sector = sectores.find((sector) => sector.id === id) || null;

    setSectorNombre(sector?.nombre || '');
  }

  function calcularHoras(desde: string, hasta: string) {
    if (!desde || !hasta) {
      return 0;
    }

    const [horaD, minD] = desde.split(':').map(Number);
    const [horaH, minH] = hasta.split(':').map(Number);

    const minutos = horaH * 60 + minH - (horaD * 60 + minD);

    return minutos > 0 ? Math.round((minutos / 60) * 100) / 100 : 0;
  }

  function cambiarHorario(desde: string, hasta: string) {
    setHoraDesde(desde);
    setHoraHasta(hasta);
    setHorasTrabajadas(calcularHoras(desde, hasta));
  }

  function agregarProducto() {
    setItems((actuales) => [...actuales, itemVacio()]);
  }

  function eliminarProducto(tempId: string) {
    if (items.length <= 1) {
      return;
    }

    setItems((actuales) => actuales.filter((item) => item.tempId !== tempId));
  }

  function actualizarItem(tempId: string, cambios: Partial<ItemCotizacion>) {
    setItems((actuales) =>
      actuales.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              ...cambios,
            }
          : item
      )
    );
  }

  function seleccionarProducto(tempId: string, productoId: string) {
    const producto = productos.find((producto) => producto.id === productoId);

    if (!producto) {
      return;
    }

    const relacion = producto.producto_proveedor?.[0];

    const costo = Number(relacion?.precio_neto_actual || 0);

    const beneficio = Number(relacion?.beneficio_sugerido || 0);

    actualizarItem(tempId, {
      producto_id: producto.id,

      proveedor_id: relacion?.proveedor_id || '',

      nombre_producto: producto.nombre,

      descripcion: producto.descripcion || '',

      precio_neto_proveedor: costo,

      beneficio_unitario: beneficio,

      precio_neto_venta: costo + beneficio,
    });
  }

  function cambiarPrecioVenta(tempId: string, precioVenta: number) {
    const item = items.find((item) => item.tempId === tempId);

    if (!item) {
      return;
    }

    actualizarItem(tempId, {
      precio_neto_venta: precioVenta,

      beneficio_unitario: precioVenta - Number(item.precio_neto_proveedor || 0),
    });
  }

  const subtotalProductos = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total +
        Number(item.precio_neto_venta || 0) * Number(item.cantidad || 0),
      0
    );
  }, [items]);

  const costoHH = Math.max(
    0,
    Number(horasTrabajadas || 0) *
      Number(numTrabajadores || 0) *
      Number(valorHora || 0)
  );

  const netoTotal = Math.max(
    0,
    subtotalProductos +
      Number(despachoNeto || 0) +
      costoHH -
      Number(descuentoNeto || 0)
  );

  const iva = Math.round(netoTotal * (ivaPorcentaje / 100));

  const totalFinal = netoTotal + iva;

  function formatoDinero(valor: number) {
    return formatearMonto(valor);
  }

  function fraseDiasTrabajo() {
    if (!fechaTrabajoInicio) {
      return '';
    }

    if (!fechaTrabajoTermino || fechaTrabajoTermino === fechaTrabajoInicio) {
      return `el día ${formatoFecha(fechaTrabajoInicio)}`;
    }

    return `los días ${formatoFecha(fechaTrabajoInicio)} al ${formatoFecha(
      fechaTrabajoTermino
    )}`;
  }

  function formatoFecha(fechaISO: string) {
    if (!fechaISO) {
      return '';
    }

    const fechaLocal = new Date(`${fechaISO}T12:00:00`);

    return fechaLocal.toLocaleDateString(LOCALE, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function validarCotizacion() {
    if (!clienteSeleccionado) {
      setError('Debes seleccionar un cliente.');

      return false;
    }

    if (!sectorId) {
      setError('Debes seleccionar un sector.');

      return false;
    }

    if (!fechaTrabajoInicio) {
      setError('Debes indicar la fecha en que se realizó el trabajo.');

      return false;
    }

    for (const item of items) {
      if (!item.producto_id) {
        setError('Todos los productos deben estar seleccionados.');

        return false;
      }

      if (Number(item.cantidad) <= 0) {
        setError('La cantidad debe ser mayor a cero.');

        return false;
      }
    }

    return true;
  }

  async function guardarCotizacion(abrirPreview = false) {
    if (!validarCotizacion() || !clienteSeleccionado) {
      return;
    }

    setGuardando(true);
    setError('');

    let estadoGuardar = estado;

    if (cotizacionId && estado !== 'Aceptada' && estado !== 'Rechazada') {
      estadoGuardar = 'Modificada';
    }

    const datosCotizacion = {
      numero,
      fecha,
      estado: estadoGuardar,
      cliente_id: clienteSeleccionado.id,
      cliente_razon_social: clienteSeleccionado.razon_social,
      cliente_rut: clienteSeleccionado.rut,
      cliente_direccion: clienteSeleccionado.direccion,
      cliente_contacto: clienteSeleccionado.contacto,
      cliente_telefono: clienteSeleccionado.telefono,
      cliente_correo: clienteSeleccionado.correo,
      sector_id: sectorId,
      sector_nombre: sectorNombre,
      numero_orden: numeroOrden.trim() || null,
      fecha_trabajo_inicio: fechaTrabajoInicio || null,
      fecha_trabajo_termino: fechaTrabajoTermino || null,
      hora_desde: horaDesde || null,
      hora_hasta: horaHasta || null,
      horas_trabajadas: Number(horasTrabajadas || 0),
      num_trabajadores: Number(numTrabajadores || 0),
      valor_hora: Number(valorHora || 0),
      costo_hh: costoHH,
      subtotal_productos_neto: subtotalProductos,
      despacho_neto: Number(despachoNeto || 0),
      descuento_neto: Number(descuentoNeto || 0),
      neto_total: netoTotal,
      iva,
      total_final: totalFinal,
      vigencia_dias: Number(vigenciaDias),
      observaciones: observaciones.trim() || null,
      pdf_generado: abrirPreview,
    };

    const itemsGuardar = items.map((item) => ({
      producto_id: item.producto_id,
      proveedor_id: item.proveedor_id || null,
      nombre_producto: item.nombre_producto,
      descripcion: item.descripcion || null,
      cantidad: Number(item.cantidad),
      precio_neto_proveedor: Number(item.precio_neto_proveedor),
      beneficio_unitario: Number(item.beneficio_unitario),
      precio_neto_venta: Number(item.precio_neto_venta),
      costo_total: Number(item.precio_neto_proveedor) * Number(item.cantidad),
      beneficio_total: Number(item.beneficio_unitario) * Number(item.cantidad),
      total_neto_linea: Number(item.precio_neto_venta) * Number(item.cantidad),
    }));

    const { data, error: guardarError } = await supabase.rpc(
      'guardar_cotizacion_transaccional',
      {
        p_cotizacion_id: cotizacionId,
        p_datos: datosCotizacion,
        p_items: itemsGuardar,
      }
    );

    if (guardarError || !data) {
      setError(
        guardarError?.message ||
          'No se pudo guardar la cotización de forma transaccional.'
      );
      setGuardando(false);
      return;
    }

    const idFinal = String(data);
    setCotizacionId(idFinal);
    setEstado(estadoGuardar);

    await cargarListadoCotizaciones();
    setGuardando(false);

    if (abrirPreview) {
      setMostrarPreview(true);
    } else {
      setMostrarFormulario(false);
    }
  }

  async function cargarListadoCotizaciones() {
    const { data, error } = await supabase
      .from('cotizaciones')
      .select(
        `
          id,
          numero,
          fecha,
          estado,
          cliente_razon_social,
          neto_total,
          iva,
          total_final
        `
      )
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      setError(error.message);
    } else {
      setCotizaciones((data || []) as CotizacionListado[]);
    }
  }

  async function editarCotizacion(id: string) {
    setLoading(true);
    setError('');

    const [cotizacionResult, itemsResult] = await Promise.all([
      supabase.from('cotizaciones').select('*').eq('id', id).single(),

      supabase
        .from('cotizacion_items')
        .select('*')
        .eq('cotizacion_id', id)
        .order('created_at'),
    ]);

    if (cotizacionResult.error || !cotizacionResult.data) {
      setError(
        cotizacionResult.error?.message || 'No se pudo abrir la cotización.'
      );

      setLoading(false);

      return;
    }

    if (itemsResult.error) {
      setError(itemsResult.error.message);

      setLoading(false);

      return;
    }

    const c = cotizacionResult.data;

    setCotizacionId(c.id);

    setNumero(c.numero);

    setFecha(c.fecha);

    setEstado(c.estado);

    setFechaFactura(c.fecha_factura || '');

    setClienteId(c.cliente_id || '');

    setClienteSeleccionado({
      id: c.cliente_id || '',

      razon_social: c.cliente_razon_social || '',

      rut: c.cliente_rut,

      direccion: c.cliente_direccion,

      contacto: c.cliente_contacto,

      telefono: c.cliente_telefono,

      correo: c.cliente_correo,
    });

    setSectorId(c.sector_id || '');
    setSectorNombre(c.sector_nombre || '');
    setNumeroOrden(c.numero_orden || '');

    setFechaTrabajoInicio(c.fecha_trabajo_inicio || '');
    setFechaTrabajoTermino(c.fecha_trabajo_termino || '');

    setHoraDesde(c.hora_desde ? String(c.hora_desde).slice(0, 5) : '');
    setHoraHasta(c.hora_hasta ? String(c.hora_hasta).slice(0, 5) : '');
    setHorasTrabajadas(Number(c.horas_trabajadas || 0));
    setNumTrabajadores(Number(c.num_trabajadores || 0));
    setValorHora(Number(c.valor_hora || 0));

    setVigenciaDias(
      Number(c.vigencia_dias || empresa.vigenciaCotizacionDias)
    );

    setDespachoNeto(Number(c.despacho_neto || 0));

    setDescuentoNeto(Number(c.descuento_neto || 0));

    setObservaciones(c.observaciones || '');

    const itemsCargados = (itemsResult.data || []).map((item) => ({
      tempId: crypto.randomUUID(),

      producto_id: item.producto_id || '',

      proveedor_id: item.proveedor_id || '',

      nombre_producto: item.nombre_producto || '',

      descripcion: item.descripcion || '',

      cantidad: Number(item.cantidad || 1),

      precio_neto_proveedor: Number(item.precio_neto_proveedor || 0),

      beneficio_unitario: Number(item.beneficio_unitario || 0),

      precio_neto_venta: Number(item.precio_neto_venta || 0),
    }));

    setItems(itemsCargados.length ? itemsCargados : [itemVacio()]);

    setMostrarFormulario(true);

    setMostrarPreview(false);

    setLoading(false);
  }

  async function cambiarEstado(nuevoEstado: 'Aceptada' | 'Rechazada') {
    if (!cotizacionId || actualizandoEstado) {
      return;
    }

    setActualizandoEstado(true);
    setError('');
    setMensajeEstado('');

    const actualizacion: Record<string, string> = {
      estado: nuevoEstado,
    };

    if (nuevoEstado === 'Aceptada') {
      actualizacion.fecha_aceptacion = fechaLocalISO();
    }

    const { error } = await supabase
      .from('cotizaciones')
      .update(actualizacion)
      .eq('id', cotizacionId);

    if (error) {
      setError(error.message);
      setActualizandoEstado(false);
      return;
    }

    setEstado(nuevoEstado);
    await cargarListadoCotizaciones();

    setMensajeEstado(
      nuevoEstado === 'Aceptada'
        ? `La cotización ${numero} fue marcada como Aceptada correctamente.`
        : `La cotización ${numero} fue marcada como Rechazada correctamente.`
    );

    setActualizandoEstado(false);

    window.setTimeout(() => {
      setMensajeEstado('');
    }, 4500);
  }

  async function guardarFechaFactura() {
    if (!cotizacionId || guardandoFechaFactura) {
      return;
    }

    setGuardandoFechaFactura(true);
    setError('');

    const { error } = await supabase
      .from('cotizaciones')
      .update({ fecha_factura: fechaFactura || null })
      .eq('id', cotizacionId);

    if (error) {
      setError(error.message);
      setGuardandoFechaFactura(false);
      return;
    }

    setMensajeEstado(
      fechaFactura
        ? `Fecha de factura guardada: ${fechaFactura}.`
        : 'Fecha de factura eliminada.'
    );

    setGuardandoFechaFactura(false);

    window.setTimeout(() => {
      setMensajeEstado('');
    }, 4500);
  }

  async function esperarImagenes(elemento: HTMLElement, timeoutMs = 4000) {
    const imagenes = Array.from(
      elemento.querySelectorAll<HTMLImageElement>('img')
    );

    await Promise.all(
      imagenes.map(async (imagen) => {
        if (!imagen.complete || imagen.naturalWidth === 0) {
          await new Promise<void>((resolve) => {
            let terminado = false;

            const finalizar = () => {
              if (terminado) {
                return;
              }

              terminado = true;
              resolve();
            };

            imagen.addEventListener('load', finalizar, { once: true });
            imagen.addEventListener('error', finalizar, { once: true });

            window.setTimeout(finalizar, timeoutMs);
          });
        }

        if (imagen.complete && imagen.naturalWidth > 0 && 'decode' in imagen) {
          try {
            await imagen.decode();
          } catch {
            // La imagen ya está visible; no bloqueamos la descarga por decode().
          }
        }
      })
    );
  }

  async function esperarRender() {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  }

  async function urlADataUrl(url: string, timeoutMs = 4000) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
      return url || null;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const respuesta = await fetch(url, {
        cache: 'force-cache',
        signal: controller.signal,
      });

      if (!respuesta.ok) {
        return null;
      }

      const blob = await respuesta.blob();

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function prepararImagenesDelClon(
    original: HTMLElement,
    clon: HTMLElement
  ) {
    const originales = Array.from(
      original.querySelectorAll<HTMLImageElement>('img')
    );
    const clonadas = Array.from(clon.querySelectorAll<HTMLImageElement>('img'));

    await Promise.all(
      clonadas.map(async (imagenClonada, index) => {
        const imagenOriginal = originales[index];
        const src =
          imagenOriginal?.currentSrc ||
          imagenOriginal?.src ||
          imagenClonada.getAttribute('src') ||
          '';

        // crossOrigin en el elemento visible puede impedir que algunas imágenes
        // de Supabase/servidores externos aparezcan. En el clon no lo necesitamos.
        imagenClonada.removeAttribute('crossorigin');
        imagenClonada.removeAttribute('srcset');
        imagenClonada.loading = 'eager';

        if (!src) {
          return;
        }

        // Primero usamos exactamente la misma URL que ya se ve en la preview.
        imagenClonada.src = src;

        // Si el servidor permite fetch/CORS, la incrustamos para que html2canvas
        // no tenga que volver a solicitarla durante su propio clonado.
        const dataUrl = await urlADataUrl(src);

        if (dataUrl) {
          imagenClonada.src = dataUrl;
        }
      })
    );
  }

  async function descargarCotizacionPDF() {
    if (generandoPDF) {
      return;
    }

    const paginaVisible = document.getElementById(
      'cotizacion-pdf'
    ) as HTMLDivElement | null;

    let hostExportacion: HTMLDivElement | null = null;

    try {
      setGenerandoPDF(true);
      setError('');

      if (!paginaVisible) {
        throw new Error('No se encontró la cotización para generar el PDF.');
      }

      // Esperamos las imágenes de la PREVIEW, pero nunca modificamos sus src.
      await esperarImagenes(paginaVisible, 2500);

      if ('fonts' in document) {
        try {
          await (document as any).fonts.ready;
        } catch {
          // No es crítico para generar el PDF.
        }
      }

      /*
       * La vista previa ya tiene exactamente el diseño que queremos.
       * Creamos una copia de ESA MISMA hoja y le quitamos solamente el scale
       * usado para verla en ventanas angostas.
       */
      const paginaExportacion = paginaVisible.cloneNode(true) as HTMLDivElement;

      paginaExportacion.id = 'cotizacion-pdf-export';
      paginaExportacion.style.transform = 'none';
      paginaExportacion.style.transformOrigin = 'top left';
      paginaExportacion.style.margin = '0';
      paginaExportacion.classList.add('pdf-capturing');
      paginaExportacion.classList.remove('quote-preview-source');

      hostExportacion = document.createElement('div');
      hostExportacion.className = 'pdf-export-host';

      hostExportacion.appendChild(paginaExportacion);
      document.body.appendChild(hostExportacion);

      // En el clon intentamos incrustar las imágenes, sin arriesgar la preview.
      await prepararImagenesDelClon(paginaVisible, paginaExportacion);
      await esperarImagenes(paginaExportacion, 3000);
      await esperarRender();

      /*
       * IMPORTANTE: html2canvas calcula la posición de los elementos usando
       * también el tamaño real de la ventana del navegador. Si no le fijamos
       * windowWidth Y windowHeight explícitamente, usa el alto real de la
       * ventana (que cambia según si está maximizada o no), y eso desalinea
       * horizontalmente la captura. Por eso ahora fijamos ambos valores al
       * tamaño real de la hoja que estamos exportando, sin depender del
       * tamaño de la ventana del usuario.
       */
      window.scrollTo(0, 0);

      const alturaExportacion = paginaExportacion.scrollHeight;

      // Chrome/Edge crean automáticamente subcarpetas dentro de Descargas
      // cuando el nombre de archivo sugerido incluye "/", por lo que cada
      // PDF queda guardado en una carpeta por mes sin pedir permisos extra.
      const carpetaMes = fecha ? fecha.slice(0, 7) : fechaLocalISO().slice(0, 7);
      const nombreArchivo = `${carpetaMes}/${numero.trim() || 'Cotizacion'}.pdf`;

      const opciones = {
        margin: 0,
        filename: nombreArchivo,
        image: {
          type: 'jpeg',
          quality: 0.98,
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          width: ANCHO_CARTA_PX,
          windowWidth: ANCHO_CARTA_PX,
          windowHeight: alturaExportacion,
          imageTimeout: 10000,
          letterRendering: true,
        },
        jsPDF: {
          unit: 'mm',
          format: 'letter',
          orientation: 'portrait',
          compress: true,
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: [
            '.quote-brand-header',
            '.quote-heading',
            '.quote-client-grid',
            '.quote-products-head',
            '.quote-product-line',
            '.quote-bottom-section',
            '.quote-summary',
            '.quote-footer',
          ],
        },
      };

      await html2pdf().set(opciones).from(paginaExportacion).save();
    } catch (err) {
      console.error('Error generando PDF:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo generar el PDF de la cotización.'
      );
    } finally {
      hostExportacion?.remove();
      setGenerandoPDF(false);
    }
  }

  function volverDesdePreview() {
    setMostrarPreview(false);
  }

  async function eliminarCotizacion(cotizacion: CotizacionListado) {
    if (!esAdmin || eliminandoId) return;

    const confirmado = window.confirm(
      `¿Eliminar permanentemente la cotización ${cotizacion.numero}?\n\nEsta acción eliminará también sus ítems y cualquier pago asociado a esta cotización. No se puede deshacer.`
    );

    if (!confirmado) return;

    setEliminandoId(cotizacion.id);
    setError('');
    setMensajeEstado('');

    const { error } = await supabase.rpc('eliminar_cotizacion_admin', {
      p_cotizacion_id: cotizacion.id,
    });

    if (error) {
      setError(error.message);
      setEliminandoId(null);
      return;
    }

    await cargarListadoCotizaciones();
    setMensajeEstado(`La cotización ${cotizacion.numero} fue eliminada.`);
    setEliminandoId(null);

    window.setTimeout(() => setMensajeEstado(''), 4500);
  }

  const cotizacionesFiltradas = cotizaciones.filter((cotizacion) => {
    const texto = busqueda.toLowerCase();

    const coincideBusqueda =
      cotizacion.numero.toLowerCase().includes(texto) ||
      cotizacion.cliente_razon_social.toLowerCase().includes(texto);

    const coincideEstado =
      filtroEstado === 'Todos' || cotizacion.estado === filtroEstado;

    return coincideBusqueda && coincideEstado;
  });

  if (loading) {
    return <p>Cargando cotizaciones...</p>;
  }

  /* ============================================================
     PREVIEW / PDF
     ============================================================ */

  if (mostrarPreview) {
    return (
      <div className="quote-preview-wrapper">
        <div className="quote-preview-actions no-print">
          <button className="secondary-button" onClick={volverDesdePreview}>
            ← Volver a editar
          </button>

          <button
            className="primary-button"
            onClick={descargarCotizacionPDF}
            disabled={generandoPDF}
          >
            {generandoPDF ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        </div>

        {error && (
          <div className="error-message quote-preview-error">{error}</div>
        )}

        <div className="quote-preview-viewport" ref={previewViewportRef}>
          <div
            className="quote-preview-holder"
            style={{
              width: `${ANCHO_CARTA_PX * previewScale}px`,
              height: `${previewPageHeight * previewScale}px`,
            }}
          >
            <div
              id="cotizacion-pdf"
              ref={previewPageRef}
              className="pdf-letter-source quote-preview-source"
              style={{ transform: `scale(${previewScale})` }}
            >
              <article className="quote-document pdf-export">
                <header className="quote-brand-header">
                  <div className="quote-brand-left">
                    <div className="quote-logo-frame">
                      <img
                        className="quote-brand-logo"
                        src={empresa.logoUrl}
                        alt={`Logo ${empresa.razonSocial}`}
                      />
                    </div>

                    <div className="quote-brand-name">
                      <strong>{empresa.razonSocial}</strong>
                    </div>
                  </div>

                  <div className="quote-company-contact">
                    <div>
                      <span className="quote-contact-icon">▣</span>

                      <span>
                        <strong>RUT:</strong> {empresa.rut}
                      </span>
                    </div>

                    <div>
                      <span className="quote-contact-icon">●</span>

                      <span>{empresa.direccion}</span>
                    </div>

                    <div>
                      <span className="quote-contact-icon">☎</span>

                      <span>{empresa.telefono}</span>
                    </div>

                    <div>
                      <span className="quote-contact-icon">✉</span>

                      <span>{empresa.correo}</span>
                    </div>
                  </div>
                </header>

                <div className="quote-green-line" />

                <section className="quote-heading">
                  <div className="quote-heading-title">
                    <h1>COTIZACIÓN</h1>

                    <div className="quote-number">
                      <span>N°</span>

                      <strong>{numero}</strong>
                    </div>
                  </div>

                  <div className="quote-meta-card">
                    <div>
                      <span className="quote-meta-icon">▣</span>

                      <strong>Fecha:</strong>

                      <span>{formatoFecha(fecha)}</span>
                    </div>

                    <div>
                      <span className="quote-meta-icon">◷</span>

                      <strong>Vigencia:</strong>

                      <span>{vigenciaDias} días</span>
                    </div>
                  </div>
                </section>

                <section className="quote-section">
                  <div className="quote-section-title">DATOS DEL CLIENTE</div>

                  <div className="quote-client-grid">
                    <div>
                      <small>Nombre / Razón social</small>

                      <strong>{clienteSeleccionado?.razon_social}</strong>
                    </div>

                    <div>
                      <small>RUT</small>

                      <strong>{clienteSeleccionado?.rut || '—'}</strong>
                    </div>

                    <div>
                      <small>Dirección</small>

                      <strong>{clienteSeleccionado?.direccion || '—'}</strong>
                    </div>
                  </div>
                </section>

                <section className="quote-section">
                  <div className="quote-section-title">DATOS DEL TRABAJO</div>

                  <div className="quote-client-grid">
                    <div>
                      <small>Sector</small>

                      <strong>{sectorNombre || '—'}</strong>
                    </div>

                    <div>
                      <small>N° de Orden</small>

                      <strong>{numeroOrden || '—'}</strong>
                    </div>

                    <div>
                      <small>Día(s) trabajado(s)</small>

                      <strong>{fraseDiasTrabajo() || '—'}</strong>
                    </div>
                  </div>
                </section>

                <section className="quote-section quote-products-section">
                  <div className="quote-section-title">PRODUCTOS</div>

                  <div className="quote-products-table">
                    <div className="quote-products-head">
                      <div>Producto y descripción</div>

                      <div>Cant.</div>

                      <div>P. unit. neto</div>

                      <div>Total neto</div>
                    </div>

                    {items.map((item) => (
                      <div className="quote-product-line" key={item.tempId}>
                        <div className="quote-product-info">
                          <strong>{item.nombre_producto}</strong>

                          {item.descripcion && <p>{item.descripcion}</p>}
                        </div>

                        <div className="quote-product-qty">{item.cantidad}</div>

                        <div className="quote-product-money">
                          {formatoDinero(item.precio_neto_venta)}
                        </div>

                        <div className="quote-product-money">
                          {formatoDinero(
                            item.precio_neto_venta * item.cantidad
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="quote-bottom-section">
                  <div className="quote-observations-box">
                    <div className="quote-section-title">DESCRIPCIÓN DEL TRABAJO</div>

                    <div className="quote-observations-content">
                      {observaciones ? <p>{observaciones}</p> : <span>—</span>}
                    </div>
                  </div>

                  <div className="quote-summary">
                    <div>
                      <span>Subtotal productos</span>

                      <strong>{formatoDinero(subtotalProductos)}</strong>
                    </div>

                    {costoHH > 0 && (
                      <div>
                        <span>Mano de obra (costo HH)</span>

                        <strong>{formatoDinero(costoHH)}</strong>
                      </div>
                    )}

                    {despachoNeto > 0 && (
                      <div>
                        <span>Costo traslado</span>

                        <strong>{formatoDinero(despachoNeto)}</strong>
                      </div>
                    )}

                    {descuentoNeto > 0 && (
                      <div>
                        <span>Descuento</span>

                        <strong>-{formatoDinero(descuentoNeto)}</strong>
                      </div>
                    )}

                    <div className="quote-summary-divider" />

                    <div className="quote-summary-net">
                      <span>Neto</span>

                      <strong>{formatoDinero(netoTotal)}</strong>
                    </div>

                    <div className="quote-summary-net">
                      <span>IVA {ivaPorcentaje}%</span>

                      <strong>{formatoDinero(iva)}</strong>
                    </div>

                    <div className="quote-summary-total">
                      <span>TOTAL</span>

                      <strong>{formatoDinero(totalFinal)}</strong>
                    </div>
                  </div>
                </section>

                <footer className="quote-footer">
                  <div className="quote-footer-message">
                    <div className="quote-footer-green-bar" />

                    <div>
                      <p>
                        Esta cotización tiene una vigencia de {vigenciaDias}{' '}
                        días desde la fecha de emisión.
                      </p>

                      <p>
                        Gracias por confiar en{' '}
                        <strong>{empresa.razonSocial}.</strong>
                      </p>
                    </div>
                  </div>

                  <div className="quote-footer-number">
                    {numero}
                    <span>|</span>
                    Cotización
                  </div>
                </footer>
              </article>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     FORMULARIO
     ============================================================ */

  if (mostrarFormulario) {
    return (
      <div className="module-page">
        <div className="module-header">
          <div>
            <p className="eyebrow">COTIZACIONES</p>

            <h1>{cotizacionId ? numero : 'Nueva cotización'}</h1>

            <p className="module-description no-print">
              Estado interno: <strong>{estado}</strong>
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() => setMostrarFormulario(false)}
          >
            ← Volver
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {mensajeEstado && (
          <div
            className={`status-change-banner ${
              estado === 'Aceptada'
                ? 'status-change-banner-success'
                : 'status-change-banner-danger'
            }`}
            role="status"
          >
            <div className="status-change-banner-icon">
              {estado === 'Aceptada' ? '✓' : '!'}
            </div>

            <div>
              <strong>Estado actualizado</strong>
              <span>{mensajeEstado}</span>
            </div>

            <button
              type="button"
              className="status-change-banner-close"
              onClick={() => setMensajeEstado('')}
              aria-label="Cerrar mensaje"
            >
              ×
            </button>
          </div>
        )}

        <div className="form-card">
          <div className="form-grid">
            <label>
              Número
              <input value={numero} disabled />
            </label>

            <label>
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
              />
            </label>

            <label>
              Cliente *
              <select
                value={clienteId}
                onChange={(event) => seleccionarCliente(event.target.value)}
              >
                <option value="">Seleccionar cliente</option>

                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razon_social}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Vigencia días
              <input
                type="number"
                min="1"
                value={vigenciaDias}
                onChange={(event) =>
                  setVigenciaDias(Number(event.target.value))
                }
              />
            </label>

            <label>
              Sector *
              <select
                value={sectorId}
                onChange={(event) => seleccionarSector(event.target.value)}
              >
                <option value="">Seleccionar sector</option>

                {sectores.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              N° de Orden
              <input
                value={numeroOrden}
                onChange={(event) => setNumeroOrden(event.target.value)}
                placeholder="N° de orden de compra del cliente"
              />
            </label>

            <label>
              Día de inicio del trabajo *
              <input
                type="date"
                value={fechaTrabajoInicio}
                onChange={(event) =>
                  setFechaTrabajoInicio(event.target.value)
                }
              />
            </label>

            <label>
              Día de término (si duró más de un día)
              <input
                type="date"
                value={fechaTrabajoTermino}
                onChange={(event) =>
                  setFechaTrabajoTermino(event.target.value)
                }
              />
            </label>
          </div>

          {clienteSeleccionado && (
            <div className="selected-client-card">
              <strong>{clienteSeleccionado.razon_social}</strong>

              <span>RUT: {clienteSeleccionado.rut || '—'}</span>

              <span>Dirección: {clienteSeleccionado.direccion || '—'}</span>
            </div>
          )}
        </div>

        <div className="form-card">
          <h2>Mano de obra</h2>

          <div className="form-grid">
            <label>
              Hora desde
              <input
                type="time"
                value={horaDesde}
                onChange={(event) =>
                  cambiarHorario(event.target.value, horaHasta)
                }
              />
            </label>

            <label>
              Hora hasta
              <input
                type="time"
                value={horaHasta}
                onChange={(event) =>
                  cambiarHorario(horaDesde, event.target.value)
                }
              />
            </label>

            <label>
              Horas trabajadas
              <input
                type="number"
                min="0"
                step="0.25"
                value={horasTrabajadas}
                onChange={(event) =>
                  setHorasTrabajadas(Number(event.target.value))
                }
              />
            </label>

            <label>
              N° de trabajadores
              <input
                type="number"
                min="0"
                value={numTrabajadores}
                onChange={(event) =>
                  setNumTrabajadores(Number(event.target.value))
                }
              />
            </label>

            <label>
              Valor hora
              <input
                type="number"
                min="0"
                value={valorHora}
                onChange={(event) => setValorHora(Number(event.target.value))}
              />
            </label>

            <label>
              Costo HH (calculado)
              <input value={formatoDinero(costoHH)} disabled />
            </label>
          </div>
        </div>

        {items.map((item, index) => (
          <div className="form-card quote-editor-item" key={item.tempId}>
            <div className="form-title">
              <h2>Producto {index + 1}</h2>

              {items.length > 1 && (
                <button
                  type="button"
                  className="table-action danger-text"
                  onClick={() => eliminarProducto(item.tempId)}
                >
                  Eliminar
                </button>
              )}
            </div>

            <div className="form-grid">
              <label className="full-width">
                Producto *
                <select
                  value={item.producto_id}
                  onChange={(event) =>
                    seleccionarProducto(item.tempId, event.target.value)
                  }
                >
                  <option value="">Seleccionar producto</option>

                  {productos.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full-width">
                Descripción
                <textarea
                  rows={4}
                  value={item.descripcion}
                  onChange={(event) =>
                    actualizarItem(item.tempId, {
                      descripcion: event.target.value,
                    })
                  }
                  placeholder="Ej: Color negro, conexión USB-C, medidas, materiales, conectores..."
                />
              </label>

              <label>
                Precio neto proveedor
                <input
                  type="number"
                  min="0"
                  value={item.precio_neto_proveedor}
                  onChange={(event) => {
                    const costo = Number(event.target.value);

                    actualizarItem(item.tempId, {
                      precio_neto_proveedor: costo,

                      precio_neto_venta: costo + item.beneficio_unitario,
                    });
                  }}
                />
              </label>

              <label>
                Beneficio por unidad
                <input
                  type="number"
                  value={item.beneficio_unitario}
                  onChange={(event) => {
                    const beneficio = Number(event.target.value);

                    actualizarItem(item.tempId, {
                      beneficio_unitario: beneficio,

                      precio_neto_venta: item.precio_neto_proveedor + beneficio,
                    });
                  }}
                />
              </label>

              <label>
                Precio neto venta
                <input
                  type="number"
                  min="0"
                  value={item.precio_neto_venta}
                  onChange={(event) =>
                    cambiarPrecioVenta(item.tempId, Number(event.target.value))
                  }
                />
              </label>

              <label>
                Cantidad
                <input
                  type="number"
                  min="1"
                  value={item.cantidad}
                  onChange={(event) =>
                    actualizarItem(item.tempId, {
                      cantidad: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="quote-item-summary">
              <span>
                Costo interno:{' '}
                <strong>
                  {formatoDinero(item.precio_neto_proveedor * item.cantidad)}
                </strong>
              </span>

              <span>
                Beneficio:{' '}
                <strong>
                  {formatoDinero(item.beneficio_unitario * item.cantidad)}
                </strong>
              </span>

              <span>
                Total neto cliente:{' '}
                <strong>
                  {formatoDinero(item.precio_neto_venta * item.cantidad)}
                </strong>
              </span>
            </div>
          </div>
        ))}

        <button
          className="secondary-button add-product-button"
          onClick={agregarProducto}
        >
          + Agregar otro producto
        </button>

        <div className="form-card">
          <h2>Resumen</h2>

          <div className="form-grid">
            <label>
              Costo traslado
              <input
                type="number"
                min="0"
                value={despachoNeto}
                onChange={(event) =>
                  setDespachoNeto(Number(event.target.value))
                }
              />
            </label>

            <label>
              Descuento neto
              <input
                type="number"
                min="0"
                value={descuentoNeto}
                onChange={(event) =>
                  setDescuentoNeto(Number(event.target.value))
                }
              />
            </label>

            <label className="full-width">
              Observaciones
              <textarea
                rows={4}
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </label>
          </div>

          <div className="quote-calculation">
            <div>
              <span>Subtotal productos</span>

              <strong>{formatoDinero(subtotalProductos)}</strong>
            </div>

            <div>
              <span>Mano de obra (costo HH)</span>

              <strong>{formatoDinero(costoHH)}</strong>
            </div>

            <div>
              <span>Costo traslado</span>

              <strong>{formatoDinero(despachoNeto)}</strong>
            </div>

            <div>
              <span>Descuento</span>

              <strong>-{formatoDinero(descuentoNeto)}</strong>
            </div>

            <div>
              <span>Neto</span>

              <strong>{formatoDinero(netoTotal)}</strong>
            </div>

            <div>
              <span>IVA {ivaPorcentaje}%</span>

              <strong>{formatoDinero(iva)}</strong>
            </div>

            <div className="quote-calculation-total">
              <span>TOTAL</span>

              <strong>{formatoDinero(totalFinal)}</strong>
            </div>
          </div>

          <div className="quote-main-actions">
            <button
              className="secondary-button"
              disabled={guardando}
              onClick={() => guardarCotizacion(false)}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>

            <button
              className="primary-button"
              disabled={guardando}
              onClick={() => guardarCotizacion(true)}
            >
              Vista previa / PDF
            </button>
          </div>

          {cotizacionId && (
            <div className="quote-status-actions no-print">
              <span>Estado interno:</span>

              <button
                className={`secondary-button status-action-button status-action-accept ${
                  estado === 'Aceptada' ? 'selected' : ''
                }`}
                disabled={actualizandoEstado || estado === 'Aceptada'}
                onClick={() => cambiarEstado('Aceptada')}
              >
                {actualizandoEstado
                  ? 'Actualizando...'
                  : estado === 'Aceptada'
                  ? '✓ Aceptada'
                  : 'Marcar como aceptada'}
              </button>

              <button
                className={`secondary-button status-action-button status-action-reject ${
                  estado === 'Rechazada' ? 'selected' : ''
                }`}
                disabled={actualizandoEstado || estado === 'Rechazada'}
                onClick={() => cambiarEstado('Rechazada')}
              >
                {actualizandoEstado
                  ? 'Actualizando...'
                  : estado === 'Rechazada'
                  ? 'Rechazada'
                  : 'Marcar como rechazada'}
              </button>
            </div>
          )}

          {cotizacionId && estado === 'Aceptada' && (
            <div className="quote-status-actions no-print">
              <span>Fecha de factura (SII):</span>

              <input
                type="date"
                value={fechaFactura}
                onChange={(event) => setFechaFactura(event.target.value)}
              />

              <button
                type="button"
                className="secondary-button status-action-button"
                disabled={guardandoFechaFactura}
                onClick={guardarFechaFactura}
              >
                {guardandoFechaFactura ? 'Guardando...' : 'Guardar fecha de factura'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ============================================================
     LISTADO
     ============================================================ */

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>

          <h1>Cotizaciones</h1>

          <p className="module-description">
            Crea, modifica y administra cotizaciones.
          </p>
        </div>

        <button className="primary-button" onClick={nuevaCotizacion}>
          + Nueva cotización
        </button>
      </div>

      <div className="quote-toolbar">
        <input
          className="search-input"
          placeholder="Buscar por N° o cliente..."
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
        />

        <select
          value={filtroEstado}
          onChange={(event) => setFiltroEstado(event.target.value)}
        >
          <option>Todos</option>

          <option>Borrador</option>

          <option>Modificada</option>

          <option>Aceptada</option>

          <option>Rechazada</option>
        </select>
      </div>

      {error && <div className="error-message">{error}</div>}
      {mensajeEstado && <div className="success-message">{mensajeEstado}</div>}

      <div className="table-card">
        {cotizacionesFiltradas.length === 0 ? (
          <div className="empty-state">
            <h3>No hay cotizaciones</h3>

            <p>Crea tu primera cotización.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>N°</th>

                <th>Fecha</th>

                <th>Cliente</th>

                <th>Neto</th>

                <th>IVA</th>

                <th>Total</th>

                <th>Estado</th>

                <th />
              </tr>
            </thead>

            <tbody>
              {cotizacionesFiltradas.map((cotizacion) => (
                <tr key={cotizacion.id}>
                  <td>
                    <strong>{cotizacion.numero}</strong>
                  </td>

                  <td>{cotizacion.fecha}</td>

                  <td>{cotizacion.cliente_razon_social}</td>

                  <td>{formatoDinero(Number(cotizacion.neto_total))}</td>

                  <td>{formatoDinero(Number(cotizacion.iva))}</td>

                  <td>
                    <strong>
                      {formatoDinero(Number(cotizacion.total_final))}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`quote-status quote-status-${cotizacion.estado.toLowerCase()}`}
                    >
                      {cotizacion.estado}
                    </span>
                  </td>

                  <td>
                    <div className="table-row-actions">
                      <button
                        className="table-action"
                        onClick={() => editarCotizacion(cotizacion.id)}
                      >
                        Abrir
                      </button>

                      {esAdmin && (
                        <button
                          className="table-action danger-text"
                          onClick={() => eliminarCotizacion(cotizacion)}
                          disabled={eliminandoId === cotizacion.id}
                        >
                          {eliminandoId === cotizacion.id ? 'Eliminando...' : 'Eliminar'}
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

export default Cotizaciones;
