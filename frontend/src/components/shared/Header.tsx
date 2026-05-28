'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  User as UserIcon, 
  KeyRound, 
  LogOut, 
  ChevronDown,
  Bell,
  Search,
  School
} from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { user, tenant, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Escuchar clics fuera para cerrar dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formatear el título de la página según la ruta
  const getPageTitle = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length <= 1) return 'Panel de Control';
    
    const lastPart = parts[parts.length - 1];
    switch (lastPart) {
      case 'courses': return 'Catálogo de Cursos y Oferta';
      case 'professors': return 'Gestión de Facultad (Profesores)';
      case 'campuses': return 'Gestión de Sedes (Aulas)';
      case 'students': return 'Expedientes y Matrícula';
      case 'grades': return 'Calificaciones Académicas';
      case 'payments': return 'Procesamiento de Pagos y Cobranzas';
      case 'predictive': return 'Programación Predictiva';
      case 'comms': return 'Centro de Comunicación';
      case 'crm': return 'CRM y Captación de Leads';
      case 'admin': return 'Herramientas Administrativas';
      default: return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
    }
  };

  const primaryColor = tenant?.primaryColor || '#6B8E4E';

  return (
    <header className="h-16 bg-white border-b border-slate-100 px-6 flex items-center justify-between relative shadow-[0_2px_15px_rgba(28,44,53,0.02)] z-20">
      
      {/* SECCIÓN IZQUIERDA: BOTÓN MENÚ Y BREADCRUMB */}
      <div className="flex items-center gap-4">
        {/* Toggle para móviles o expandir */}
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-slate-50 active:bg-slate-100 rounded-xl text-[#1C2C35]/70 transition-colors cursor-pointer md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb / Título */}
        <div className="flex items-center gap-2.5">
          <School className="w-4.5 h-4.5 text-[#1C2C35]/40" />
          <span className="text-[#1C2C35]/30 text-sm font-medium">/</span>
          <span className="font-semibold text-[#1C2C35] text-sm tracking-wide">
            {getPageTitle()}
          </span>
        </div>
      </div>

      {/* SECCIÓN DERECHA: BÚSQUEDA, NOTIFICACIONES Y PERFIL (USER-ID SIEMPRE VISIBLE) */}
      <div className="flex items-center gap-5">
        
        {/* Buscador inteligente */}
        <div className="relative hidden lg:block w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar alumno, curso..." 
            className="w-full pl-9 pr-4 py-2 border border-slate-100 rounded-xl bg-slate-50/50 text-xs text-[#1C2C35] placeholder-slate-400 focus:outline-none focus:border-slate-200 focus:bg-white transition-all"
          />
        </div>

        {/* Campanita de Notificaciones */}
        <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-[#1C2C35] transition-colors relative cursor-pointer">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="h-6 w-[1px] bg-slate-100" />

        {/* PERFIL DE USUARIO: USER-ID VISIBLE CON DROPDOWN */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3.5 hover:bg-slate-50/80 active:bg-slate-100 p-1.5 pr-3.5 rounded-2xl transition-all cursor-pointer select-none"
          >
            {/* Avatar del usuario */}
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shadow-sm">
              {user?.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt={user.firstName} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#1C2C35] font-bold text-xs uppercase" style={{ color: primaryColor }}>
                  {user?.firstName.charAt(0)}{user?.lastName.charAt(0)}
                </div>
              )}
            </div>

            {/* Credenciales / USER-ID del usuario (Siempre visible) */}
            <div className="text-left hidden sm:flex flex-col">
              <span className="text-xs font-bold text-[#1C2C35] leading-tight">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[10px] font-semibold text-[#1C2C35]/50 tracking-wider">
                ID: {user?.id.split('-')[1] || 'Guest'} ({user?.roleName})
              </span>
            </div>

            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {/* MENÚ DESPLEGABLE PREMIUM */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2.5 w-56 bg-white rounded-2xl shadow-[0_10px_40px_rgba(28,44,53,0.08)] border border-slate-100 p-1.5 space-y-0.5 animate-fade-in z-50">
              
              <div className="px-3 py-2 border-b border-slate-100 mb-1.5">
                <p className="text-xs font-bold text-[#1C2C35] truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email}</p>
              </div>

              {/* Botón: Perfil / Ver ID */}
              <button 
                onClick={() => { setDropdownOpen(false); alert(`Información del Usuario:\nNombre: ${user?.firstName} ${user?.lastName}\nCorreo: ${user?.email}\nID Completo: ${user?.id}\nRol: ${user?.roleName}`); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1C2C35]/70 hover:text-[#1C2C35] hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-slate-400" />
                Mi Perfil
              </button>

              {/* Botón: Cambio de Contraseña */}
              <button 
                onClick={() => { setDropdownOpen(false); alert('Enlace de restablecimiento de contraseña enviado a su correo.'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#1C2C35]/70 hover:text-[#1C2C35] hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-slate-400" />
                Cambio de Contraseña
              </button>

              <div className="h-[1px] bg-slate-100 my-1" />

              {/* Botón: Cerrar Sesión */}
              <button 
                onClick={() => { setDropdownOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-500 hover:text-white hover:bg-red-500/10 hover:text-red-600 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>

            </div>
          )}
        </div>

      </div>

    </header>
  );
}
