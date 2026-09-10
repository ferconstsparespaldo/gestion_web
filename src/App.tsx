import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import './App.css';
import './Fachada.css';

import { supabase } from './lib/supabase';
import { EmpresaProvider, useEmpresa } from './context/EmpresaContext';
import { iniciales } from './utils/formato';

import Clientes from './components/Clientes';
import Proveedores from './components/Proveedores';
import Productos from './components/Productos';
import Cotizaciones from './components/Cotizaciones';
import Configuracion from './components/Configuracion';
import Pagos from './components/Pagos';
import Gastos from './components/Gastos';
import EstadoResultados from './components/EstadoResultados';
import Impuestos from './components/Impuestos';
import Capital from './components/Capital';
import Dashboard from './components/Dashboard';

const NOMBRE_APP = (import.meta.env.VITE_APP_NAME || 'Plataforma de Gestión').trim();
const MARCA_APP = iniciales(NOMBRE_APP) || 'GE';

type Profile = {
  id: string;
  nombre: string | null;
  rol: 'admin' | 'trabajador';
  activo: boolean;
};

type Pagina =
  | 'dashboard'
  | 'clientes'
  | 'cotizaciones'
  | 'productos'
  | 'proveedores'
  | 'pagos'
  | 'gastos'
  | 'resultados'
  | 'impuestos'
  | 'capital'
  | 'configuracion';

const NOMBRE_PAGINA: Record<Pagina, string> = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  cotizaciones: 'Cotizaciones',
  productos: 'Productos',
  proveedores: 'Proveedores',
  pagos: 'Pagos',
  gastos: 'Gastos',
  resultados: 'Estado de Resultados',
  impuestos: 'Impuestos',
  capital: 'Capital de socios',
  configuracion: 'Configuración',
};

const SECCION_PAGINA: Record<Pagina, string> = {
  dashboard: 'Principal',
  clientes: 'Comercial',
  cotizaciones: 'Comercial',
  productos: 'Catálogo',
  proveedores: 'Catálogo',
  pagos: 'Finanzas',
  gastos: 'Finanzas',
  resultados: 'Finanzas',
  impuestos: 'Finanzas',
  capital: 'Finanzas',
  configuracion: 'Sistema',
};

function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pagina, setPagina] = useState<Pagina>('dashboard');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    document.title = NOMBRE_APP;
  }, []);

  useEffect(() => {
    cargarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        await cargarPerfil(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function cargarSesion() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);

    if (session?.user) {
      await cargarPerfil(session.user.id);
    }

    setLoading(false);
  }

  async function cargarPerfil(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
          id,
          nombre,
          rol,
          activo
        `
      )
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error cargando perfil:', error);
      setProfile(null);
      return;
    }

    setProfile(data as Profile);
  }

  async function iniciarSesion(event: React.FormEvent) {
    event.preventDefault();

    setLoginError('');
    setLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError('Correo o contraseña incorrectos.');
    }

    setLoginLoading(false);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();

    setProfile(null);
    setPagina('dashboard');
  }

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-mark">{MARCA_APP}</div>
        <span>Cargando plataforma...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="login-page login-page-premium">
        <div className="login-shell">
          <section className="login-showcase">
            <div className="login-showcase-brand">
              <div className="login-showcase-mark">{MARCA_APP}</div>
              <div>
                <strong>{NOMBRE_APP}</strong>
              </div>
            </div>

            <div className="login-showcase-content">
              <p className="login-showcase-kicker">GESTIÓN CENTRALIZADA</p>
              <h1>Tu operación, ventas y finanzas en un solo lugar.</h1>
              <p>
                Administra clientes, cotizaciones, productos y el control financiero
                de la empresa desde una plataforma interna simple y ordenada.
              </p>
            </div>

            <div className="login-showcase-tags">
              <span>Comercial</span>
              <span>Catálogo</span>
              <span>Finanzas</span>
            </div>
          </section>

          <section className="login-panel">
            <div className="login-card login-card-premium">
              <div className="login-mobile-brand">
                <div className="brand-mark">{MARCA_APP}</div>
                <div>
                  <h1>{NOMBRE_APP}</h1>
                </div>
              </div>

              <div className="login-heading-block">
                <span>Bienvenido</span>
                <h2>Ingresa a tu cuenta</h2>
                <p>Accede a la plataforma de gestión interna.</p>
              </div>

              {loginError && <div className="error-message">{loginError}</div>}

              <form onSubmit={iniciarSesion}>
                <label className="login-label">
                  Correo
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="correo@empresa.cl"
                    required
                  />
                </label>

                <label className="login-label">
                  Contraseña
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </label>

                <button
                  className="login-button"
                  type="submit"
                  disabled={loginLoading}
                >
                  {loginLoading ? 'Ingresando...' : 'Ingresar a la plataforma'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="app-loading-screen">No se pudo cargar el perfil.</div>;
  }

  if (!profile.activo) {
    return (
      <div className="login-page login-page-premium">
        <div className="login-card login-card-premium standalone-login-card">
          <div className="login-mobile-brand visible">
            <div className="brand-mark">{MARCA_APP}</div>
            <div>
              <h1>{NOMBRE_APP}</h1>
            </div>
          </div>

          <div className="error-message">
            Tu usuario se encuentra inactivo. Contacta al administrador.
          </div>

          <button className="login-button" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const esAdmin = profile.rol === 'admin';

  return (
    <EmpresaProvider>
      <AppShell
        profile={profile}
        session={session}
        esAdmin={esAdmin}
        pagina={pagina}
        setPagina={setPagina}
        cerrarSesion={cerrarSesion}
      />
    </EmpresaProvider>
  );
}

type AppShellProps = {
  profile: Profile;
  session: Session;
  esAdmin: boolean;
  pagina: Pagina;
  setPagina: (pagina: Pagina) => void;
  cerrarSesion: () => void;
};

function AppShell({
  profile,
  session,
  esAdmin,
  pagina,
  setPagina,
  cerrarSesion,
}: AppShellProps) {
  const { empresa } = useEmpresa();

  useEffect(() => {
    document.title = empresa.razonSocial;
  }, [empresa.razonSocial]);

  const inicialUsuario = (profile.nombre || session.user.email || 'U')
    .charAt(0)
    .toUpperCase();

  const marcaEmpresa = iniciales(empresa.razonSocial) || MARCA_APP;

  function renderPagina() {
    switch (pagina) {
      case 'clientes':
        return <Clientes esAdmin={esAdmin} />;

      case 'cotizaciones':
        return <Cotizaciones esAdmin={esAdmin} />;

      case 'productos':
        return <Productos esAdmin={esAdmin} />;

      case 'proveedores':
        return <Proveedores esAdmin={esAdmin} />;

      case 'pagos':
        return esAdmin ? <Pagos /> : null;

      case 'gastos':
        return esAdmin ? <Gastos /> : null;

      case 'resultados':
        return esAdmin ? <EstadoResultados /> : null;

      case 'impuestos':
        return esAdmin ? <Impuestos /> : null;

      case 'capital':
        return esAdmin ? <Capital /> : null;

      case 'configuracion':
        return esAdmin ? <Configuracion /> : null;

      case 'dashboard':
      default:
        return (
          <Dashboard
            esAdmin={esAdmin}
            cambiarPagina={(destino) => setPagina(destino as Pagina)}
          />
        );
    }
  }

  return (
    <div className="app app-redesign">
      <aside className="app-sidebar">
        <div className="sidebar-brand sidebar-brand-premium">
          <div className="sidebar-logo-symbol">{marcaEmpresa}</div>

          <div className="sidebar-brand-copy">
            <p className="sidebar-small">GESTIÓN INTERNA</p>
            <h2>{empresa.razonSocial}</h2>
          </div>
        </div>

        <nav className="app-navigation">
          <p className="nav-section-title">PRINCIPAL</p>

          <button
            className={pagina === 'dashboard' ? 'active' : ''}
            onClick={() => setPagina('dashboard')}
          >
            <span className="nav-icon">▦</span>
            <span>Dashboard</span>
          </button>

          <div className="nav-divider" />
          <p className="nav-section-title">COMERCIAL</p>

          <button
            className={pagina === 'clientes' ? 'active' : ''}
            onClick={() => setPagina('clientes')}
          >
            <span className="nav-icon">◉</span>
            <span>Clientes</span>
          </button>

          <button
            className={pagina === 'cotizaciones' ? 'active' : ''}
            onClick={() => setPagina('cotizaciones')}
          >
            <span className="nav-icon">▤</span>
            <span>Cotizaciones</span>
          </button>

          <div className="nav-divider" />
          <p className="nav-section-title">CATÁLOGO</p>

          <button
            className={pagina === 'productos' ? 'active' : ''}
            onClick={() => setPagina('productos')}
          >
            <span className="nav-icon">◇</span>
            <span>Productos</span>
          </button>

          <button
            className={pagina === 'proveedores' ? 'active' : ''}
            onClick={() => setPagina('proveedores')}
          >
            <span className="nav-icon">▣</span>
            <span>Proveedores</span>
          </button>

          {esAdmin && (
            <>
              <div className="nav-divider" />
              <p className="nav-section-title">FINANZAS</p>

              <button
                className={pagina === 'pagos' ? 'active' : ''}
                onClick={() => setPagina('pagos')}
              >
                <span className="nav-icon">$</span>
                <span>Pagos</span>
              </button>

              <button
                className={pagina === 'gastos' ? 'active' : ''}
                onClick={() => setPagina('gastos')}
              >
                <span className="nav-icon">↓</span>
                <span>Gastos</span>
              </button>

              <button
                className={pagina === 'resultados' ? 'active' : ''}
                onClick={() => setPagina('resultados')}
              >
                <span className="nav-icon">⌁</span>
                <span>Estado de Resultados</span>
              </button>

              <button
                className={pagina === 'impuestos' ? 'active' : ''}
                onClick={() => setPagina('impuestos')}
              >
                <span className="nav-icon">%</span>
                <span>Impuestos</span>
              </button>

              <button
                className={pagina === 'capital' ? 'active' : ''}
                onClick={() => setPagina('capital')}
              >
                <span className="nav-icon">◈</span>
                <span>Capital de socios</span>
              </button>

              <div className="nav-divider" />
              <p className="nav-section-title">SISTEMA</p>

              <button
                className={pagina === 'configuracion' ? 'active' : ''}
                onClick={() => setPagina('configuracion')}
              >
                <span className="nav-icon">⚙</span>
                <span>Configuración</span>
              </button>
            </>
          )}
        </nav>

        <div className="user-box user-box-premium">
          <div className="user-avatar">{inicialUsuario}</div>

          <div className="user-info">
            <strong>{profile.nombre || session.user.email}</strong>
            <span>{esAdmin ? 'Administrador' : 'Trabajador'}</span>
          </div>

          <button
            className="logout-button"
            onClick={cerrarSesion}
            title="Cerrar sesión"
          >
            ↪
          </button>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <div className="app-topbar-location">
            <span>{SECCION_PAGINA[pagina]}</span>
            <strong>{NOMBRE_PAGINA[pagina]}</strong>
          </div>

          <div className="app-topbar-user">
            <div className="app-topbar-avatar">{inicialUsuario}</div>
            <div>
              <strong>{profile.nombre || 'Usuario'}</strong>
              <span>{esAdmin ? 'Administrador' : 'Trabajador'}</span>
            </div>
          </div>
        </header>

        <main className="content app-content">{renderPagina()}</main>
      </div>
    </div>
  );
}

export default App;
