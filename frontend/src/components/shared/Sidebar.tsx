'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import * as Icons from 'lucide-react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  School, 
  Shield, 
  GraduationCap,
  LogOut
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { tenant, menuAccess, user, logout } = useAuthStore();
  const { isSidebarExpanded, sidebarWidth, toggleSidebar, setSidebarWidth } = useUIStore();
  const resizingRef = useRef(false);
  const [openFolders, setOpenFolders] = React.useState<Record<string, boolean>>({
    'm-config': true // Pre-open config folder by default for a stunning visual layout
  });

  const toggleFolder = (folderId: string) => {
    setOpenFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Color de acento dinámico según el Tenant
  const activeColor = tenant?.primaryColor || '#6B8E4E';

  // Obtener icono dinámicamente desde Lucide
  const renderIcon = (iconName: string) => {
    const LucideIcon = (Icons as any)[iconName];
    if (LucideIcon) {
      return <LucideIcon className="w-5 h-5 transition-all duration-300 shrink-0" />;
    }
    return <Icons.HelpCircle className="w-5 h-5 shrink-0" />;
  };

  // Manejar el arrastre para redimensionar (Drag-to-resize resizable sidebar)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    
    // Cambiar estilos globales de cursor durante el drag
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    
    // Límites de la barra lateral (mínimo 220px, máximo 400px)
    const newWidth = e.clientX;
    if (newWidth >= 220 && newWidth <= 420) {
      setSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    resizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Ancho efectivo del sidebar
  const currentWidth = isSidebarExpanded ? sidebarWidth : 80;

  return (
    <aside 
      className="h-screen bg-[#1C2C35] text-white flex flex-col justify-between border-r border-[#1C2C35]/15 relative transition-all duration-100 ease-out z-25 shrink-0"
      style={{ width: currentWidth }}
    >
      
      {/* 1. SECCIÓN DE ENCABEZADO (LOGO Y TENANT) */}
      <div>
        <div className="h-16 flex items-center px-4 justify-between border-b border-white/5 relative">
          
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0 shadow-inner">
              {user?.roleId === 'r-superadmin' ? (
                <Shield className="w-5 h-5 text-[#9CBA7F]" />
              ) : tenant?.logoUrl ? (
                <School className="w-5 h-5 text-[#9CBA7F]" />
              ) : (
                <GraduationCap className="w-5 h-5 text-[#9CBA7F]" />
              )}
            </div>
            
            {isSidebarExpanded && (
              <div className="flex flex-col animate-fade-in whitespace-nowrap overflow-hidden">
                <span className="font-bold text-sm leading-tight text-white tracking-wide truncate max-w-[140px]">
                  {tenant?.name || 'SincroEdu Hub'}
                </span>
                <span className="text-[10px] text-[#9CBA7F] tracking-wider font-bold uppercase leading-none mt-0.5">
                  {user?.roleName || 'Portal'}
                </span>
              </div>
            )}
          </div>

          {/* Botón de Colapsado */}
          <button 
            onClick={toggleSidebar}
            className="absolute top-1/2 -translate-y-1/2 -right-3.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white rounded-full p-1 border-2 border-[#1C2C35] shadow-md hover:scale-105 cursor-pointer z-30 transition-all hidden md:flex items-center justify-center"
          >
            {isSidebarExpanded ? (
              <ChevronLeft className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* 2. LISTADO DE MENÚS DINÁMICOS */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] select-none">
          {menuAccess
            .filter((m) => m.parentId === null)
            .map((menu) => {
              const children = menuAccess.filter((child) => child.parentId === menu.id);
              const hasChildren = children.length > 0;
              const isActive = pathname === menu.route || children.some(c => pathname === c.route);
              const isFolderOpen = !!openFolders[menu.id];

              if (hasChildren) {
                return (
                  <div key={menu.id} className="space-y-1">
                    {/* Botón de Carpeta Desplegable */}
                    <button
                      onClick={() => toggleFolder(menu.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative cursor-pointer ${
                        isActive 
                          ? 'text-white bg-white/5 font-bold shadow-sm' 
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 w-full">
                        {/* Icono de Carpeta */}
                        <div className={`${isActive ? 'text-[#9CBA7F]' : 'text-white/60 group-hover:text-white shrink-0'}`}>
                          {renderIcon(menu.icon)}
                        </div>

                        {/* Título de Carpeta (Sidebar Expandido) */}
                        {isSidebarExpanded && (
                          <span className="animate-fade-in tracking-wide truncate max-w-[130px] block">
                            {menu.title}
                          </span>
                        )}
                      </div>

                      {/* Indicador de Desplegado (Chevron) */}
                      {isSidebarExpanded && (
                        <div className="text-white/40 group-hover:text-white shrink-0">
                          {isFolderOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 transition-transform" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 transition-transform" />
                          )}
                        </div>
                      )}

                      {/* Dropdown Flotante en Sidebar Colapsado */}
                      {!isSidebarExpanded && (
                        <div className="absolute left-16 bg-[#1C2C35] text-white text-xs font-semibold p-2.5 rounded-2xl border border-white/10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-2 transition-all shadow-2xl min-w-[200px] z-50 flex flex-col gap-1 text-left">
                          <span className="font-bold text-[10px] text-[#9CBA7F] uppercase tracking-wider mb-1 block px-2 border-b border-white/5 pb-1">{menu.title}</span>
                          {children.map((child) => {
                            const isChildActive = pathname === child.route;
                            return (
                              <Link
                                key={child.id}
                                href={child.route}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                                  isChildActive ? 'text-white bg-white/10 font-bold' : 'text-white/65 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                {renderIcon(child.icon)}
                                <span>{child.title}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </button>

                    {/* Contenedor de Elementos Hijos Indentados (Sidebar Expandido) */}
                    {isSidebarExpanded && isFolderOpen && (
                      <div className="pl-5 border-l border-white/10 ml-5.5 mt-1 space-y-1 animate-scale-up">
                        {children.map((child) => {
                          const isChildActive = pathname === child.route;
                          return (
                            <Link
                              key={child.id}
                              href={child.route}
                              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all group ${
                                isChildActive 
                                  ? 'text-white font-bold bg-white/10' 
                                  : 'text-white/50 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <div className={`${isChildActive ? 'text-[#9CBA7F]' : 'text-white/40 group-hover:text-white shrink-0'}`}>
                                {renderIcon(child.icon)}
                              </div>
                              <span className="truncate">{child.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Menú estándar sin hijos
              const isMenuLinkActive = pathname === menu.route;
              return (
                <Link
                  key={menu.id}
                  href={menu.route}
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative overflow-hidden ${
                    isMenuLinkActive 
                      ? 'text-white shadow-lg shadow-black/10' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  style={isMenuLinkActive ? { backgroundColor: activeColor } : undefined}
                >
                  {/* Icono del Menú */}
                  <div className={`${isMenuLinkActive ? 'scale-110 text-white' : 'text-white/60 group-hover:text-white shrink-0'}`}>
                    {renderIcon(menu.icon)}
                  </div>

                  {/* Texto del Menú */}
                  {isSidebarExpanded ? (
                    <span className="animate-fade-in tracking-wide truncate max-w-full block">
                      {menu.title}
                    </span>
                  ) : (
                    // Tooltip flotante en estado colapsado
                    <div className="absolute left-16 bg-[#1C2C35] text-white text-xs font-semibold px-3 py-2 rounded-lg border border-white/10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1.5 transition-all shadow-xl whitespace-nowrap z-50">
                      {menu.title}
                    </div>
                  )}
                </Link>
              );
            })}
        </nav>
      </div>

      {/* 3. SECCIÓN DE PIE (LOGOUT Y PERFIL SÚPER CORTO) */}
      <div className="p-3 border-t border-white/5 space-y-2 relative">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/20 transition-all group relative cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-red-400 group-hover:text-white transition-colors shrink-0" />
          
          {isSidebarExpanded ? (
            <span className="animate-fade-in tracking-wide truncate block">Cerrar Sesión</span>
          ) : (
            <div className="absolute left-16 bg-red-600 text-white text-xs font-semibold px-3 py-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1.5 transition-all shadow-xl whitespace-nowrap z-50">
              Cerrar Sesión
            </div>
          )}
        </button>
      </div>

      {/* CONTROL DE RESIZING (Borde derecho interactivo y arrastrable) */}
      {isSidebarExpanded && (
        <div 
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-[#6B8E4E]/40 active:bg-[#6B8E4E] cursor-col-resize z-40 transition-colors group"
        >
          {/* Línea sutil decorativa de hover */}
          <div className="w-[1px] h-full bg-white/5 group-hover:bg-[#6B8E4E]/60 mx-auto" />
        </div>
      )}

    </aside>
  );
}
