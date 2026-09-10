import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { STORAGE } from '../lib/storage';
import { formatearFecha } from '../utils/formato';
import { useEmpresa } from '../context/EmpresaContext';

type ConfiguracionForm = {
  razon_social: string;
  rut: string;
  direccion: string;
  telefono: string;
  correo: string;
  logo_url: string;
  iva_porcentaje: number;
  vigencia_cotizacion_dias: number;
  prefijo_cotizacion: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  rut_titular: string;
  correo_pago: string;
};

type TabConfiguracion = 'empresa' | 'cotizaciones' | 'usuarios' | 'parametros';
type RolUsuario = 'admin' | 'trabajador';

type UsuarioAdmin = {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  created_at: string | null;
  perfil_configurado: boolean;
};

type UsuarioForm = {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  password: string;
};

const CONFIG_POR_DEFECTO: ConfiguracionForm = {
  razon_social: '',
  rut: '',
  direccion: '',
  telefono: '',
  correo: '',
  logo_url: STORAGE.logoUrlPorDefecto,
  iva_porcentaje: 19,
  vigencia_cotizacion_dias: 15,
  prefijo_cotizacion: 'COT',
  banco: '',
  tipo_cuenta: '',
  numero_cuenta: '',
  titular: '',
  rut_titular: '',
  correo_pago: '',
};

const USUARIO_VACIO: UsuarioForm = {
  id: '',
  email: '',
  nombre: '',
  rol: 'trabajador',
  activo: true,
  password: '',
};

function Configuracion() {
  const { recargar: recargarEmpresa } = useEmpresa();
  const [tab, setTab] = useState<TabConfiguracion>('empresa');
  const [configId, setConfigId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfiguracionForm>(CONFIG_POR_DEFECTO);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [usuarioForm, setUsuarioForm] = useState<UsuarioForm>(USUARIO_VACIO);
  const [mostrarUsuarioForm, setMostrarUsuarioForm] = useState(false);
  const [usuarioError, setUsuarioError] = useState('');
  const [usuarioMensaje, setUsuarioMensaje] = useState('');

  const editandoUsuario = Boolean(usuarioForm.id);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  useEffect(() => {
    if (tab === 'usuarios' && usuarios.length === 0) {
      cargarUsuarios();
    }
  }, [tab]);

  const resumenUsuarios = useMemo(() => {
    const activos = usuarios.filter((usuario) => usuario.activo).length;
    const admins = usuarios.filter(
      (usuario) => usuario.activo && usuario.rol === 'admin'
    ).length;
    const trabajadores = usuarios.filter(
      (usuario) => usuario.activo && usuario.rol === 'trabajador'
    ).length;

    return { activos, admins, trabajadores };
  }, [usuarios]);

  async function cargarConfiguracion() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('configuracion_empresa')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setConfigId(data.id);
      setForm({
        razon_social: data.razon_social || '',
        rut: data.rut || '',
        direccion: data.direccion || '',
        telefono: data.telefono || '',
        correo: data.correo || '',
        logo_url: data.logo_url || CONFIG_POR_DEFECTO.logo_url,
        iva_porcentaje: Number(data.iva_porcentaje ?? 19),
        vigencia_cotizacion_dias: Number(data.vigencia_cotizacion_dias ?? 15),
        prefijo_cotizacion: data.prefijo_cotizacion || 'COT',
        banco: data.banco || '',
        tipo_cuenta: data.tipo_cuenta || '',
        numero_cuenta: data.numero_cuenta || '',
        titular: data.titular || '',
        rut_titular: data.rut_titular || '',
        correo_pago: data.correo_pago || '',
      });
    } else {
      setConfigId(null);
      setForm(CONFIG_POR_DEFECTO);
    }

    setLoading(false);
  }

  function actualizarCampo(
    campo: keyof ConfiguracionForm,
    valor: string | number
  ) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  }

  async function manejarCambioLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    if (archivo.type !== 'image/png') {
      setError('El logo debe ser un archivo PNG.');
      event.target.value = '';
      return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
      setError('El logo no puede pesar más de 5 MB.');
      event.target.value = '';
      return;
    }

    setSubiendoLogo(true);
    setError('');
    setMensaje('');

    try {
      const { error: uploadError } = await supabase.storage
        .from(STORAGE.bucketAssets)
        .upload(STORAGE.logoPath, archivo, {
          upsert: true,
          cacheControl: '3600',
          contentType: archivo.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(STORAGE.bucketAssets)
        .getPublicUrl(STORAGE.logoPath);
      const urlConVersion = `${data.publicUrl}?v=${Date.now()}`;

      setForm((actual) => ({ ...actual, logo_url: urlConVersion }));
      setMensaje('Logo actualizado. Guarda los cambios para conservar la nueva URL.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el logo.');
    } finally {
      setSubiendoLogo(false);
      event.target.value = '';
    }
  }

  async function guardarConfiguracion(event?: React.FormEvent) {
    event?.preventDefault();

    setGuardando(true);
    setError('');
    setMensaje('');

    const datos = {
      razon_social: form.razon_social.trim(),
      rut: form.rut.trim() || null,
      direccion: form.direccion.trim() || null,
      telefono: form.telefono.trim() || null,
      correo: form.correo.trim() || null,
      logo_url: form.logo_url.trim() || null,
      iva_porcentaje: Number(form.iva_porcentaje),
      vigencia_cotizacion_dias: Number(form.vigencia_cotizacion_dias),
      prefijo_cotizacion: form.prefijo_cotizacion.trim() || 'COT',
      banco: form.banco.trim() || null,
      tipo_cuenta: form.tipo_cuenta.trim() || null,
      numero_cuenta: form.numero_cuenta.trim() || null,
      titular: form.titular.trim() || null,
      rut_titular: form.rut_titular.trim() || null,
      correo_pago: form.correo_pago.trim() || null,
    };

    if (configId) {
      const { error } = await supabase
        .from('configuracion_empresa')
        .update(datos)
        .eq('id', configId);

      if (error) {
        setError(error.message);
        setGuardando(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('configuracion_empresa')
        .insert(datos)
        .select('id')
        .single();

      if (error || !data) {
        setError(error?.message || 'No se pudo guardar la configuración.');
        setGuardando(false);
        return;
      }

      setConfigId(data.id);
    }

    setMensaje('Cambios guardados correctamente.');
    setGuardando(false);
    await recargarEmpresa();
  }

  async function invocarAdminUsuarios(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body,
    });

    if (error) {
      let mensajeError = error.message;
      try {
        const contexto = (error as any).context;
        if (contexto?.json) {
          const detalle = await contexto.json();
          mensajeError = detalle?.error || detalle?.message || mensajeError;
        }
      } catch {
        // Si no podemos leer el cuerpo de error, usamos el mensaje estándar.
      }
      throw new Error(mensajeError);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async function cargarUsuarios() {
    setLoadingUsuarios(true);
    setUsuarioError('');

    try {
      const data = await invocarAdminUsuarios({ action: 'list' });
      setUsuarios((data?.usuarios || []) as UsuarioAdmin[]);
    } catch (err) {
      setUsuarioError(
        err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.'
      );
    } finally {
      setLoadingUsuarios(false);
    }
  }

  function nuevoUsuario() {
    setUsuarioForm(USUARIO_VACIO);
    setUsuarioError('');
    setUsuarioMensaje('');
    setMostrarUsuarioForm(true);
  }

  function editarUsuario(usuario: UsuarioAdmin) {
    setUsuarioForm({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      activo: usuario.activo,
      password: '',
    });
    setUsuarioError('');
    setUsuarioMensaje('');
    setMostrarUsuarioForm(true);
  }

  async function guardarUsuario(event: React.FormEvent) {
    event.preventDefault();
    setGuardandoUsuario(true);
    setUsuarioError('');
    setUsuarioMensaje('');

    try {
      if (!usuarioForm.nombre.trim()) {
        throw new Error('Debes ingresar el nombre del usuario.');
      }

      if (!editandoUsuario && !usuarioForm.email.trim()) {
        throw new Error('Debes ingresar el correo del usuario.');
      }

      if (!editandoUsuario && usuarioForm.password.length < 8) {
        throw new Error('La contraseña temporal debe tener al menos 8 caracteres.');
      }

      if (editandoUsuario && usuarioForm.password && usuarioForm.password.length < 8) {
        throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
      }

      if (editandoUsuario) {
        await invocarAdminUsuarios({
          action: 'update',
          id: usuarioForm.id,
          nombre: usuarioForm.nombre.trim(),
          rol: usuarioForm.rol,
          activo: usuarioForm.activo,
          password: usuarioForm.password || undefined,
        });
        setUsuarioMensaje('Usuario actualizado correctamente.');
      } else {
        await invocarAdminUsuarios({
          action: 'create',
          email: usuarioForm.email.trim().toLowerCase(),
          password: usuarioForm.password,
          nombre: usuarioForm.nombre.trim(),
          rol: usuarioForm.rol,
          activo: usuarioForm.activo,
        });
        setUsuarioMensaje('Usuario creado correctamente. Ya puede iniciar sesión.');
      }

      setMostrarUsuarioForm(false);
      setUsuarioForm(USUARIO_VACIO);
      await cargarUsuarios();
    } catch (err) {
      setUsuarioError(
        err instanceof Error ? err.message : 'No se pudo guardar el usuario.'
      );
    } finally {
      setGuardandoUsuario(false);
    }
  }

  if (loading) {
    return <p>Cargando configuración...</p>;
  }

  return (
    <div className="module-page config-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">SISTEMA</p>
          <h1>Configuración</h1>
          <p className="module-description">
            Empresa, cotizaciones, usuarios y parámetros generales.
          </p>
        </div>
      </div>

      <div className="config-tabs" role="tablist" aria-label="Secciones de configuración">
        <button
          className={tab === 'empresa' ? 'active' : ''}
          onClick={() => setTab('empresa')}
          type="button"
        >
          Empresa
        </button>
        <button
          className={tab === 'cotizaciones' ? 'active' : ''}
          onClick={() => setTab('cotizaciones')}
          type="button"
        >
          Cotizaciones
        </button>
        <button
          className={tab === 'usuarios' ? 'active' : ''}
          onClick={() => setTab('usuarios')}
          type="button"
        >
          Usuarios
        </button>
        <button
          className={tab === 'parametros' ? 'active' : ''}
          onClick={() => setTab('parametros')}
          type="button"
        >
          Parámetros
        </button>
      </div>

      {tab !== 'usuarios' && error && <div className="error-message">{error}</div>}
      {tab !== 'usuarios' && mensaje && (
        <div className="success-message">{mensaje}</div>
      )}

      {tab === 'empresa' && (
        <form onSubmit={guardarConfiguracion}>
          <div className="form-card">
            <div className="config-section-heading">
              <div>
                <span>IDENTIDAD</span>
                <h2>Datos de la empresa</h2>
              </div>
            </div>

            <div className="form-grid">
              <label className="full-width">
                Razón social
                <input
                  value={form.razon_social}
                  onChange={(event) =>
                    actualizarCampo('razon_social', event.target.value)
                  }
                  required
                />
              </label>
              <label>
                RUT
                <input
                  value={form.rut}
                  onChange={(event) => actualizarCampo('rut', event.target.value)}
                />
              </label>
              <label>
                Teléfono
                <input
                  value={form.telefono}
                  onChange={(event) =>
                    actualizarCampo('telefono', event.target.value)
                  }
                />
              </label>
              <label className="full-width">
                Dirección
                <input
                  value={form.direccion}
                  onChange={(event) =>
                    actualizarCampo('direccion', event.target.value)
                  }
                />
              </label>
              <label className="full-width">
                Correo
                <input
                  type="email"
                  value={form.correo}
                  onChange={(event) =>
                    actualizarCampo('correo', event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="form-card">
            <div className="config-section-heading">
              <div>
                <span>MARCA</span>
                <h2>Logo</h2>
              </div>
            </div>

            <div className="config-logo-layout">
              <div className="config-logo-preview">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo actual" />
                ) : (
                  <span>Sin logo</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/png"
                  onChange={manejarCambioLogo}
                  disabled={subiendoLogo}
                />
                {subiendoLogo && <p className="small-muted">Subiendo logo...</p>}
                <p className="module-description config-help">
                  El logo se utiliza automáticamente en cotizaciones y documentos.
                </p>
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="config-section-heading">
              <div>
                <span>PAGOS</span>
                <h2>Datos bancarios</h2>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Banco
                <input
                  value={form.banco}
                  onChange={(event) => actualizarCampo('banco', event.target.value)}
                />
              </label>
              <label>
                Tipo de cuenta
                <input
                  value={form.tipo_cuenta}
                  onChange={(event) =>
                    actualizarCampo('tipo_cuenta', event.target.value)
                  }
                />
              </label>
              <label>
                Número de cuenta
                <input
                  value={form.numero_cuenta}
                  onChange={(event) =>
                    actualizarCampo('numero_cuenta', event.target.value)
                  }
                />
              </label>
              <label>
                Titular
                <input
                  value={form.titular}
                  onChange={(event) => actualizarCampo('titular', event.target.value)}
                />
              </label>
              <label>
                RUT titular
                <input
                  value={form.rut_titular}
                  onChange={(event) =>
                    actualizarCampo('rut_titular', event.target.value)
                  }
                />
              </label>
              <label>
                Correo para pagos
                <input
                  type="email"
                  value={form.correo_pago}
                  onChange={(event) =>
                    actualizarCampo('correo_pago', event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="config-save-row">
            <button className="primary-button" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar empresa'}
            </button>
          </div>
        </form>
      )}

      {tab === 'cotizaciones' && (
        <form onSubmit={guardarConfiguracion}>
          <div className="form-card config-single-card">
            <div className="config-section-heading">
              <div>
                <span>DOCUMENTOS</span>
                <h2>Parámetros de cotización</h2>
                <p>Valores que se cargan automáticamente al crear una cotización.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Prefijo de cotización
                <input
                  value={form.prefijo_cotizacion}
                  onChange={(event) =>
                    actualizarCampo('prefijo_cotizacion', event.target.value)
                  }
                  placeholder="COT"
                />
              </label>
              <label>
                Vigencia por defecto (días)
                <input
                  type="number"
                  min="1"
                  value={form.vigencia_cotizacion_dias}
                  onChange={(event) =>
                    actualizarCampo(
                      'vigencia_cotizacion_dias',
                      Number(event.target.value)
                    )
                  }
                />
              </label>
            </div>

            <div className="config-preview-note">
              <strong>Ejemplo de numeración</strong>
              <span>
                {(form.prefijo_cotizacion || 'COT').toUpperCase()}-{new Date().getFullYear()}-0001
              </span>
            </div>
          </div>

          <div className="config-save-row">
            <button className="primary-button" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cotizaciones'}
            </button>
          </div>
        </form>
      )}

      {tab === 'parametros' && (
        <form onSubmit={guardarConfiguracion}>
          <div className="form-card config-single-card">
            <div className="config-section-heading">
              <div>
                <span>PARÁMETROS GENERALES</span>
                <h2>Impuestos y cálculos</h2>
                <p>Valores utilizados por los módulos para realizar cálculos automáticos.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                IVA por defecto (%)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.iva_porcentaje}
                  onChange={(event) =>
                    actualizarCampo('iva_porcentaje', Number(event.target.value))
                  }
                />
              </label>
            </div>

            <div className="config-info-box">
              <strong>¿Dónde se usa?</strong>
              <p>
                Este porcentaje se utiliza en cotizaciones, gastos y cálculos internos.
                Modificarlo afectará los documentos nuevos, no reescribe registros históricos.
              </p>
            </div>
          </div>

          <div className="config-save-row">
            <button className="primary-button" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar parámetros'}
            </button>
          </div>
        </form>
      )}

      {tab === 'usuarios' && (
        <section className="config-users-section">
          {usuarioError && <div className="error-message">{usuarioError}</div>}
          {usuarioMensaje && (
            <div className="success-message">{usuarioMensaje}</div>
          )}

          <div className="config-user-kpis">
            <div>
              <span>Usuarios activos</span>
              <strong>{resumenUsuarios.activos}</strong>
            </div>
            <div>
              <span>Administradores</span>
              <strong>{resumenUsuarios.admins}</strong>
            </div>
            <div>
              <span>Trabajadores</span>
              <strong>{resumenUsuarios.trabajadores}</strong>
            </div>
          </div>

          <div className="config-users-toolbar">
            <div>
              <h2>Usuarios y permisos</h2>
              <p>
                Administra quién puede ingresar y qué nivel de acceso tiene cada cuenta.
              </p>
            </div>
            <button className="primary-button" type="button" onClick={nuevoUsuario}>
              + Nuevo usuario
            </button>
          </div>

          <div className="config-permission-grid">
            <div className="config-permission-card admin">
              <div className="config-permission-icon">A</div>
              <div>
                <strong>Administrador</strong>
                <p>
                  Acceso completo a Comercial, Catálogo, Finanzas, Impuestos y Configuración.
                </p>
              </div>
            </div>
            <div className="config-permission-card worker">
              <div className="config-permission-icon">T</div>
              <div>
                <strong>Trabajador</strong>
                <p>
                  Acceso a Dashboard comercial, Clientes, Cotizaciones, Productos y Proveedores.
                </p>
              </div>
            </div>
          </div>

          <div className="table-card config-users-table-card">
            {loadingUsuarios ? (
              <div className="empty-state">
                <h3>Cargando usuarios...</h3>
              </div>
            ) : usuarios.length === 0 ? (
              <div className="empty-state">
                <h3>No hay usuarios</h3>
                <p>Crea la primera cuenta desde este módulo.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Creado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>
                        <div className="config-user-identity">
                          <div className="config-user-avatar">
                            {(usuario.nombre || usuario.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{usuario.nombre || 'Sin nombre'}</strong>
                            <span>{usuario.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`config-role-badge ${usuario.rol}`}>
                          {usuario.rol === 'admin' ? 'Administrador' : 'Trabajador'}
                        </span>
                      </td>
                      <td>
                        <span className={`config-status-badge ${usuario.activo ? 'active' : 'inactive'}`}>
                          <i />
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        {usuario.created_at
                          ? formatearFecha(usuario.created_at)
                          : '—'}
                      </td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => editarUsuario(usuario)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {mostrarUsuarioForm && (
            <div className="config-modal-backdrop" role="presentation">
              <div className="config-user-modal" role="dialog" aria-modal="true">
                <div className="config-modal-header">
                  <div>
                    <span>{editandoUsuario ? 'EDITAR CUENTA' : 'NUEVA CUENTA'}</span>
                    <h2>{editandoUsuario ? 'Editar usuario' : 'Crear usuario'}</h2>
                  </div>
                  <button
                    type="button"
                    className="config-modal-close"
                    onClick={() => setMostrarUsuarioForm(false)}
                    aria-label="Cerrar"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={guardarUsuario}>
                  <div className="form-grid">
                    <label className="full-width">
                      Nombre
                      <input
                        value={usuarioForm.nombre}
                        onChange={(event) =>
                          setUsuarioForm((actual) => ({
                            ...actual,
                            nombre: event.target.value,
                          }))
                        }
                        placeholder="Ej: Juan Pérez"
                        required
                      />
                    </label>

                    <label className="full-width">
                      Correo
                      <input
                        type="email"
                        value={usuarioForm.email}
                        onChange={(event) =>
                          setUsuarioForm((actual) => ({
                            ...actual,
                            email: event.target.value,
                          }))
                        }
                        disabled={editandoUsuario}
                        placeholder="usuario@empresa.cl"
                        required={!editandoUsuario}
                      />
                      {editandoUsuario && (
                        <small>El correo se mantiene fijo para proteger la identidad de la cuenta.</small>
                      )}
                    </label>

                    <label>
                      Rol
                      <select
                        value={usuarioForm.rol}
                        onChange={(event) =>
                          setUsuarioForm((actual) => ({
                            ...actual,
                            rol: event.target.value as RolUsuario,
                          }))
                        }
                      >
                        <option value="trabajador">Trabajador</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </label>

                    <label className="config-toggle-field">
                      Estado
                      <button
                        type="button"
                        className={`config-toggle ${usuarioForm.activo ? 'on' : ''}`}
                        onClick={() =>
                          setUsuarioForm((actual) => ({
                            ...actual,
                            activo: !actual.activo,
                          }))
                        }
                      >
                        <span />
                        {usuarioForm.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </label>

                    <label className="full-width">
                      {editandoUsuario ? 'Nueva contraseña (opcional)' : 'Contraseña temporal'}
                      <input
                        type="password"
                        value={usuarioForm.password}
                        onChange={(event) =>
                          setUsuarioForm((actual) => ({
                            ...actual,
                            password: event.target.value,
                          }))
                        }
                        minLength={8}
                        required={!editandoUsuario}
                        placeholder={editandoUsuario ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres'}
                      />
                    </label>
                  </div>

                  <div className="config-modal-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setMostrarUsuarioForm(false)}
                      disabled={guardandoUsuario}
                    >
                      Cancelar
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={guardandoUsuario}
                    >
                      {guardandoUsuario
                        ? 'Guardando...'
                        : editandoUsuario
                          ? 'Guardar usuario'
                          : 'Crear usuario'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Configuracion;
