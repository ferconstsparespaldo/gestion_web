import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '../lib/supabase';

export type EmpresaConfig = {
  id: string | null;
  razonSocial: string;
  rut: string;
  direccion: string;
  telefono: string;
  correo: string;
  logoUrl: string;
  ivaPorcentaje: number;
  vigenciaCotizacionDias: number;
  prefijoCotizacion: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string;
  rutTitular: string;
  correoPago: string;
};

export const EMPRESA_POR_DEFECTO: EmpresaConfig = {
  id: null,
  razonSocial: 'Tu Empresa',
  rut: '',
  direccion: '',
  telefono: '',
  correo: '',
  logoUrl: '',
  ivaPorcentaje: 19,
  vigenciaCotizacionDias: 15,
  prefijoCotizacion: 'COT',
  banco: '',
  tipoCuenta: '',
  numeroCuenta: '',
  titular: '',
  rutTitular: '',
  correoPago: '',
};

type EmpresaContextValue = {
  empresa: EmpresaConfig;
  cargando: boolean;
  recargar: () => Promise<void>;
};

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<EmpresaConfig>(EMPRESA_POR_DEFECTO);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);

    const { data, error } = await supabase
      .from('configuracion_empresa')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error cargando configuración de empresa:', error);
    } else if (data) {
      setEmpresa({
        id: data.id ?? null,
        razonSocial: data.razon_social || EMPRESA_POR_DEFECTO.razonSocial,
        rut: data.rut || '',
        direccion: data.direccion || '',
        telefono: data.telefono || '',
        correo: data.correo || '',
        logoUrl: data.logo_url || '',
        ivaPorcentaje: Number(
          data.iva_porcentaje ?? EMPRESA_POR_DEFECTO.ivaPorcentaje
        ),
        vigenciaCotizacionDias: Number(
          data.vigencia_cotizacion_dias ??
            EMPRESA_POR_DEFECTO.vigenciaCotizacionDias
        ),
        prefijoCotizacion:
          data.prefijo_cotizacion || EMPRESA_POR_DEFECTO.prefijoCotizacion,
        banco: data.banco || '',
        tipoCuenta: data.tipo_cuenta || '',
        numeroCuenta: data.numero_cuenta || '',
        titular: data.titular || '',
        rutTitular: data.rut_titular || '',
        correoPago: data.correo_pago || '',
      });
    }

    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const value = useMemo(
    () => ({ empresa, cargando, recargar: cargar }),
    [empresa, cargando, cargar]
  );

  return (
    <EmpresaContext.Provider value={value}>{children}</EmpresaContext.Provider>
  );
}

export function useEmpresa(): EmpresaContextValue {
  const context = useContext(EmpresaContext);

  if (!context) {
    throw new Error('useEmpresa debe usarse dentro de <EmpresaProvider>.');
  }

  return context;
}
