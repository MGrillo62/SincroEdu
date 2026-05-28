'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Shield, 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  CheckCircle,
  Sparkles,
  School,
  GraduationCap
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, error, isLoading, isAuthenticated, checkAuth, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemoAccs, setShowDemoAccs] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Tema dinámico de vista previa (Multi-tenant preview)
  const [detectedTenant, setDetectedTenant] = useState<'sincroedu' | 'colegiopremium' | 'ciencias' | 'default'>('default');

  useEffect(() => {
    setIsClient(true);
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Cambiar tema dinámicamente según el correo que escriben
  useEffect(() => {
    const emailLower = email.toLowerCase();
    if (emailLower.includes('superadmin@sincroedu.com')) {
      setDetectedTenant('sincroedu');
    } else if (emailLower.includes('@colegiopremium.edu')) {
      setDetectedTenant('colegiopremium');
    } else if (emailLower.includes('@ciencias-innovacion')) {
      setDetectedTenant('ciencias');
    } else {
      setDetectedTenant('default');
    }
    clearError();
  }, [email, clearError]);

  if (!isClient) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    const success = await login(email, password);
    if (success) {
      router.push('/dashboard');
    }
  };

  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('sincro123');
    setShowDemoAccs(false);
  };

  // Definir colores y logos dinámicos para la vista previa del Tenant
  const getTenantBranding = () => {
    switch (detectedTenant) {
      case 'sincroedu':
        return {
          primary: 'from-[#1C2C35] to-[#1C2C35]/95',
          accent: 'bg-[#6B8E4E]',
          textAccent: 'text-[#6B8E4E]',
          borderColor: 'focus:border-[#6B8E4E]',
          ringColor: 'focus:ring-[#6B8E4E]/20',
          title: 'SincroEdu Global',
          subtitle: 'Consola Superadministrador'
        };
      case 'colegiopremium':
        return {
          primary: 'from-[#1C2C35] to-[#1C2C35]/95',
          accent: 'bg-[#6B8E4E]',
          textAccent: 'text-[#6B8E4E]',
          borderColor: 'focus:border-[#6B8E4E]',
          ringColor: 'focus:ring-[#6B8E4E]/20',
          title: 'SincroEdu Premium College',
          subtitle: 'Portal Académico Institucional'
        };
      case 'ciencias':
        return {
          primary: 'from-blue-950 to-slate-900',
          accent: 'bg-blue-600',
          textAccent: 'text-blue-500',
          borderColor: 'focus:border-blue-500',
          ringColor: 'focus:ring-blue-500/20',
          title: 'I.C. Innovación',
          subtitle: 'Plataforma Virtual de Aprendizaje'
        };
      default:
        return {
          primary: 'from-[#1C2C35] to-[#1C2C35]/95',
          accent: 'bg-[#6B8E4E]',
          textAccent: 'text-[#6B8E4E]',
          borderColor: 'focus:border-[#6B8E4E]',
          ringColor: 'focus:ring-[#6B8E4E]/20',
          title: 'SincroEdu',
          subtitle: 'Ecosistema de Gestión Educativa Premium'
        };
    }
  };

  const brand = getTenantBranding();

  return (
    <main className="min-h-screen bg-[#FAFBF9] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* 1. ELEMENTOS DE FONDO PREMIUM (GRADIENTES SUAVES Y ESTRUCTURAS ABSTRACTAS) */}
      <div className="absolute top-[-30%] left-[-20%] w-[80vw] h-[80vw] bg-[#6B8E4E]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[80vw] h-[80vw] bg-[#1C2C35]/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* 2. CONTENEDOR PRINCIPAL */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_20px_50px_rgba(28,44,53,0.06)] border border-[#1C2C35]/5 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px] z-10">
        
        {/* PANEL IZQUIERDO: DECORATIVO PREMIUM CON LOGO RESALTADO */}
        <section className={`md:col-span-5 bg-gradient-to-br ${brand.primary} p-8 text-white flex flex-col justify-between relative overflow-hidden transition-all duration-700`}>
          {/* Capa de tramado orbital de fondo */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
          
          {/* Logo y Encabezado de la Escuela */}
          <header className="z-10 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                {detectedTenant === 'sincroedu' ? (
                  <Shield className="w-5 h-5 text-white animate-pulse" />
                ) : detectedTenant === 'colegiopremium' ? (
                  <School className="w-5 h-5 text-white" />
                ) : (
                  <GraduationCap className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="font-semibold text-lg tracking-wider">SincroEdu</span>
            </div>
          </header>

          {/* CONTENEDOR DEL LOGO INTEGRADO Y DISEÑADO PARA APRECIARSE (Con marco blanco elegante sobre fondo oscuro) */}
          <div className="my-auto z-10 relative flex flex-col items-center text-center space-y-6 py-8">
            
            {/* Tarjeta del Logo adaptada para que resalte y se aprecie perfectamente */}
            <div className="w-48 h-48 rounded-3xl bg-white p-4 shadow-[0_15px_35px_rgba(0,0,0,0.2)] border border-white/10 flex items-center justify-center hover:scale-105 transition-all duration-500">
              <img 
                src="/brand/logo.png" 
                alt="SincroEdu Logo" 
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>

            <div className="space-y-2 max-w-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#6B8E4E]/20 border border-[#6B8E4E]/30 text-[#9CBA7F]">
                <Sparkles className="w-3.5 h-3.5" /> Multi-Tenant Smart Login
              </span>
              
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
                {brand.title}
              </h1>
              <p className="text-white/70 text-xs leading-relaxed">
                {brand.subtitle}. Introduce tus credenciales autorizadas para iniciar sesión en tu campus.
              </p>
            </div>
          </div>

          {/* Footer del panel izquierdo */}
          <footer className="z-10 relative text-xs text-white/50 text-center">
            &copy; {new Date().getFullYear()} SincroEdu Premium. Todos los derechos reservados.
          </footer>
        </section>

        {/* PANEL DERECHO: FORMULARIO DE ACCESO */}
        <section className="md:col-span-7 p-8 md:p-12 flex flex-col justify-between bg-white relative">
          
          <div className="w-full max-w-sm mx-auto space-y-8 my-auto">
            {/* Header del formulario */}
            <div>
              {/* Logo SincroEdu pequeño de cabecera en el formulario */}
              <div className="flex items-center gap-2 mb-3 md:hidden">
                <img 
                  src="/brand/logo.png" 
                  alt="SincroEdu Logo" 
                  className="w-12 h-12 object-contain bg-slate-50 p-1.5 rounded-xl border border-slate-100" 
                />
                <span className="font-extrabold text-[#1C2C35] text-lg">SincroEdu</span>
              </div>
              
              <h2 className="text-2xl font-bold text-[#1C2C35] tracking-tight">Bienvenido al Hub Educativo</h2>
              <p className="text-[#1C2C35]/65 text-xs mt-1.5">
                Ingresa los datos provistos por la administración de tu colegio.
              </p>
            </div>

            {/* Formulario de Login */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl text-xs flex items-start gap-2.5 shadow-sm animate-shake">
                  <span className="font-semibold">Error:</span> {error}
                </div>
              )}

              {/* Input: Email */}
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block" htmlFor="email">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1C2C35]/40" />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="nombre@colegiopremium.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-[#1C2C35] placeholder-slate-400 bg-slate-50/50 outline-none transition-all ${brand.borderColor} ${brand.ringColor} focus:bg-white focus:shadow-md`}
                  />
                </div>
              </div>

              {/* Input: Contraseña */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block" htmlFor="password">
                    Contraseña
                  </label>
                  <a href="#" className={`text-[10px] font-bold ${brand.textAccent} hover:underline`}>
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1C2C35]/40" />
                  <input
                    id="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-[#1C2C35] placeholder-slate-400 bg-slate-50/50 outline-none transition-all ${brand.borderColor} ${brand.ringColor} focus:bg-white focus:shadow-md`}
                  />
                </div>
              </div>

              {/* Botón de envío */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 ${brand.accent} text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all cursor-pointer disabled:opacity-75 disabled:pointer-events-none`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Iniciando sesión segura...
                  </>
                ) : (
                  <>
                    Entrar al Campus
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Contenedor de cuentas de prueba */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <button
                type="button"
                onClick={() => setShowDemoAccs(!showDemoAccs)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-[#1C2C35]/70 text-[10px] font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5 text-[#6B8E4E]" />
                {showDemoAccs ? 'Ocultar Credenciales de Demostración' : 'Ver Credenciales de Prueba (Roles)'}
              </button>

              {showDemoAccs && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 grid grid-cols-1 gap-2 text-[10px] animate-fade-in shadow-inner max-h-[170px] overflow-y-auto">
                  <div 
                    onClick={() => selectDemoAccount('superadmin@sincroedu.com')}
                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition-all flex justify-between items-center bg-white/40"
                  >
                    <div>
                      <p className="font-bold text-[#1C2C35]">Santiago Delgado (Superadmin)</p>
                      <p className="text-[9px] text-[#1C2C35]/60">superadmin@sincroedu.com</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[8px] font-bold uppercase shrink-0">Superadmin</span>
                  </div>
                  <div 
                    onClick={() => selectDemoAccount('admin@colegiopremium.edu')}
                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition-all flex justify-between items-center bg-white/40"
                  >
                    <div>
                      <p className="font-bold text-[#1C2C35]">Patricia Ruiz (Admin Tenant)</p>
                      <p className="text-[9px] text-[#1C2C35]/60">admin@colegiopremium.edu</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-[#6B8E4E]/10 text-[#6B8E4E] text-[8px] font-bold uppercase shrink-0">Admin Tenant</span>
                  </div>
                  <div 
                    onClick={() => selectDemoAccount('profesor@colegiopremium.edu')}
                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition-all flex justify-between items-center bg-white/40"
                  >
                    <div>
                      <p className="font-bold text-[#1C2C35]">Mateo Silva (Profesor)</p>
                      <p className="text-[9px] text-[#1C2C35]/60">profesor@colegiopremium.edu</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[8px] font-bold uppercase shrink-0">Docente</span>
                  </div>
                  <div 
                    onClick={() => selectDemoAccount('auxiliar@colegiopremium.edu')}
                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition-all flex justify-between items-center bg-white/40"
                  >
                    <div>
                      <p className="font-bold text-[#1C2C35]">Laura Vegas (Auxiliar)</p>
                      <p className="text-[9px] text-[#1C2C35]/60">auxiliar@colegiopremium.edu</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[8px] font-bold uppercase shrink-0">Auxiliar</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="text-center text-[10px] text-[#1C2C35]/40 mt-8">
            Conexión protegida por encriptación AES-256 a nivel de nodo de red.
          </div>
        </section>

      </div>
    </main>
  );
}
