'use client';

import { getApiUrl } from '@/lib/config';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Users, 
  MapPin, 
  TrendingUp,
  Shield,
  Check,
  Save,
  Plus,
  RefreshCw,
  Info,
  Building,
  MonitorPlay,
  CalendarCheck,
  Clock,
  UserCheck
} from 'lucide-react';

interface RoleOption {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
}

interface MenuPermissionConfig {
  menuOptionId: string;
  title: string;
  module: string;
  icon: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export default function DashboardPage() {
  const { user, tenant, token, checkAuth } = useAuthStore();
  
  // Estados para Roles y Permisos Dinámicos
  const [rolesList, setRolesList] = useState<RoleOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [permissionsConfig, setPermissionsConfig] = useState<MenuPermissionConfig[]>([]);
  
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const [loadingRoles, setLoadingRoles] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Obtener roles al iniciar sesión
  const fetchRoles = async () => {
    if (!token || !tenant) return;
    setLoadingRoles(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setRolesList(data);
        // Seleccionar el primer rol que no sea el principal admin del sistema
        const firstEditableRole = data.find((r: RoleOption) => !r.isSystemRole) || data[0];
        if (firstEditableRole) {
          setSelectedRoleId(firstEditableRole.id);
        }
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  // Obtener permisos del rol seleccionado
  const fetchPermissions = async (roleId: string) => {
    if (!token || !tenant || !roleId) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/roles/${roleId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setPermissionsConfig(data.permissions);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [token, tenant]);

  useEffect(() => {
    if (selectedRoleId) {
      fetchPermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  // Manejar cambios en el checkbox de permisos dinámicos
  const handlePermissionChange = (menuId: string, key: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
    setPermissionsConfig(prev => 
      prev.map(p => {
        if (p.menuOptionId === menuId) {
          const updatedValue = !p[key];
          const viewValue = (key !== 'canView' && updatedValue) ? true : p.canView;
          
          return {
            ...p,
            [key]: updatedValue,
            canView: key === 'canView' ? updatedValue : viewValue
          };
        }
        return p;
      })
    );
  };

  // Guardar permisos editados en la API
  const handleSavePermissions = async () => {
    if (!token || !tenant || !selectedRoleId) return;
    setSavingPermissions(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/roles/${selectedRoleId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ permissions: permissionsConfig })
      });

      if (res.ok) {
        setSaveMessage('✓ ¡Permisos de rol actualizados con éxito en el servidor!');
        if (user?.roleId === selectedRoleId) {
          await checkAuth();
        }
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        const data = await res.json();
        alert(`Error al guardar: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al actualizar permisos');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Crear un nuevo rol
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim() || !token || !tenant) return;
    
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDesc
        })
      });

      if (res.ok) {
        const newRole = await res.json();
        setNewRoleName('');
        setNewRoleDesc('');
        setIsNewRoleModalOpen(false);
        await fetchRoles();
        setSelectedRoleId(newRole.id);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al crear rol');
    }
  };

  // Color primario de acento dinámico según el Tenant
  const activeColor = tenant?.primaryColor || '#6B8E4E';

  return (
    <div className="space-y-8 font-sans">
      
      {/* 1. SECCIÓN DE ENCABEZADO DE BIENVENIDA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(28,44,53,0.02)]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1C2C35]">
            ¡Hola, {user?.firstName} {user?.lastName}! 👋
          </h1>
          <p className="text-[#1C2C35]/60 text-xs md:text-sm mt-1">
            {user?.roleId === 'r-superadmin' 
              ? 'Consola de administración global de SincroEdu. Monitorea y administra todas las instituciones.'
              : `Bienvenido al panel general de ${tenant?.name || 'su institución'}.`}
          </p>
        </div>
        
        {tenant && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-[#1C2C35]/70 uppercase tracking-wider">
              {tenant.name} ({tenant.status})
            </span>
          </div>
        )}
      </div>

      {/* 2. TARJETAS DE KPIS PRINCIPALES (REDISEÑADAS SEGÚN REQUERIMIENTO) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* KPI 1: Sedes (Total vs Activas) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sedes Institucionales</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-[#1C2C35]">4 Sedes</span>
              <span className="text-xs font-semibold text-slate-400">totales</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              3 Sedes Activas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E] group-hover:scale-110 transition-transform">
            <Building className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Aulas Físicas (Total vs Activas) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aulas Físicas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-[#1C2C35]">24 Aulas</span>
              <span className="text-xs font-semibold text-slate-400">instaladas</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              20 Aulas Activas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Aulas Virtuales (Total vs Activas) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aulas Virtuales</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-[#1C2C35]">12 Aulas</span>
              <span className="text-xs font-semibold text-slate-400">creadas</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              12 Aulas Activas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
            <MonitorPlay className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Tasa de Asistencia */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tasa de Asistencia</span>
            <span className="text-3xl font-extrabold text-[#1C2C35] block">95.4%</span>
            <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">Ciclo Escolar Activo</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 5: Ocupabilidad de horas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horas Usadas vs Disponibles</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#1C2C35]">78.2%</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">312h / 400h</span>
            </div>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full block mt-1">Ocupabilidad Horas Aula</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 6: Profesores Vigentes */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profesores Vigentes</span>
            <span className="text-3xl font-extrabold text-[#1C2C35] block">48 Activos</span>
            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">Contratos Vigentes</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

      </section>

      {/* 3. CORE INTERACTIVO PREMIUM: CONFIGURACIÓN DINÁMICA DE ROLES Y PERMISOS DE MENÚ */}
      {tenant && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_40px_rgba(28,44,53,0.015)] overflow-hidden">
          
          <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div className="space-y-1">
              <h2 className="text-base md:text-lg font-bold text-[#1C2C35] flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: activeColor }} />
                Matriz de Roles Dinámicos por Menú
              </h2>
              <p className="text-[#1C2C35]/60 text-xs">
                Asigna permisos marcando las opciones de menú que este rol puede ver y operar. El menú lateral cambiará dinámicamente.
              </p>
            </div>
            
            <button
              onClick={() => setIsNewRoleModalOpen(true)}
              className="px-4 py-2 text-white font-medium text-xs rounded-xl flex items-center gap-2 hover:scale-[1.02] shadow-md transition-all cursor-pointer"
              style={{ backgroundColor: activeColor }}
            >
              <Plus className="w-4 h-4" />
              Crear Nuevo Rol
            </button>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Columna Izquierda: Selector de Roles */}
              <div className="lg:col-span-3 space-y-4">
                <label className="text-xs font-bold text-[#1C2C35]/85 uppercase tracking-wider block">
                  1. Seleccione un Rol
                </label>
                
                {loadingRoles ? (
                  <div className="py-6 text-center text-xs text-slate-400">Cargando roles...</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {rolesList.map((role) => {
                      const isSelected = selectedRoleId === role.id;
                      return (
                        <button
                          key={role.id}
                          onClick={() => { setSelectedRoleId(role.id); setSaveMessage(null); }}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected 
                              ? 'border-transparent text-white shadow-md' 
                              : 'border-slate-150 text-[#1C2C35]/70 hover:bg-slate-50'
                          }`}
                          style={isSelected ? { backgroundColor: activeColor } : undefined}
                        >
                          <span className="font-bold text-sm block">{role.name}</span>
                          <span className={`text-[10px] mt-1 block truncate max-w-full ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                            {role.description || 'Sin descripción.'}
                          </span>
                          
                          {role.isSystemRole && (
                            <span className={`inline-block mt-2 self-start px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase ${
                              isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              Sistema
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-[#1C2C35]/60 leading-relaxed flex gap-2">
                  <Info className="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Instrucción:</strong> Para probar el dinamismo, selecciona <strong>Profesor</strong> o <strong>Auxiliar</strong>, marca/desmarca menús y haz clic en guardar. Si estás logueado con ese rol, el sidebar se actualizará de inmediato.
                  </span>
                </div>
              </div>

              {/* Columna Derecha: Matriz de Permisos */}
              <div className="lg:col-span-9 space-y-5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#1C2C35]/85 uppercase tracking-wider block">
                    2. Configuración de Accesos del Rol Seleccionado
                  </label>
                  
                  {selectedRoleId && (
                    <span className="text-xs font-bold text-slate-400">
                      ID Rol: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">{selectedRoleId}</code>
                    </span>
                  )}
                </div>

                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-inner bg-slate-50/20 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider">
                        <th className="py-3 px-4">Opción de Menú</th>
                        <th className="py-3 px-4 text-center">Ver Menú (Visual)</th>
                        <th className="py-3 px-4 text-center">Crear</th>
                        <th className="py-3 px-4 text-center">Editar</th>
                        <th className="py-3 px-4 text-center">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-[#1C2C35]/80 bg-white">
                      {permissionsConfig.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Seleccione un rol de la lista izquierda para cargar permisos.
                          </td>
                        </tr>
                      ) : (
                        permissionsConfig.map((perm) => (
                          <tr key={perm.menuOptionId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 font-bold text-[#1C2C35] flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeColor }} />
                              {perm.title}
                            </td>
                            {/* Ver */}
                            <td className="py-3 px-4 text-center">
                              <input 
                                type="checkbox"
                                checked={perm.canView}
                                onChange={() => handlePermissionChange(perm.menuOptionId, 'canView')}
                                className="w-4.5 h-4.5 rounded border-slate-300 accent-[#6B8E4E] cursor-pointer"
                              />
                            </td>
                            {/* Crear */}
                            <td className="py-3 px-4 text-center">
                              <input 
                                type="checkbox"
                                checked={perm.canCreate}
                                onChange={() => handlePermissionChange(perm.menuOptionId, 'canCreate')}
                                className="w-4.5 h-4.5 rounded border-slate-300 accent-[#6B8E4E] cursor-pointer"
                              />
                            </td>
                            {/* Editar */}
                            <td className="py-3 px-4 text-center">
                              <input 
                                type="checkbox"
                                checked={perm.canEdit}
                                onChange={() => handlePermissionChange(perm.menuOptionId, 'canEdit')}
                                className="w-4.5 h-4.5 rounded border-slate-300 accent-[#6B8E4E] cursor-pointer"
                              />
                            </td>
                            {/* Eliminar */}
                            <td className="py-3 px-4 text-center">
                              <input 
                                type="checkbox"
                                checked={perm.canDelete}
                                onChange={() => handlePermissionChange(perm.menuOptionId, 'canDelete')}
                                className="w-4.5 h-4.5 rounded border-slate-300 accent-[#6B8E4E] cursor-pointer"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Acciones de guardar permisos */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold text-green-650">
                    {saveMessage && <span>{saveMessage}</span>}
                  </div>
                  
                  <button
                    onClick={handleSavePermissions}
                    disabled={savingPermissions || !selectedRoleId}
                    className="w-full sm:w-auto px-6 py-3 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    style={{ backgroundColor: activeColor }}
                  >
                    {savingPermissions ? (
                      <>
                        <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4.5 h-4.5" />
                        Guardar Permisos del Rol
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>
          </div>

        </section>
      )}

      {/* 4. MODAL: CREACIÓN DE NUEVO ROL DINÁMICO */}
      {isNewRoleModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#1C2C35]">Crear Nuevo Rol Dinámico</h3>
              <p className="text-xs text-slate-400 mt-1">
                Registra un rol personalizado para tu colegio y configura sus permisos de menú.
              </p>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1C2C35]/80 uppercase tracking-wider block" htmlFor="role-name">
                  Nombre del Rol
                </label>
                <input
                  id="role-name"
                  type="text"
                  required
                  placeholder="ej: Coordinador, Tutor, Administrador Aux"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1C2C35]/80 uppercase tracking-wider block" htmlFor="role-desc">
                  Descripción
                </label>
                <textarea
                  id="role-desc"
                  rows={3}
                  placeholder="Describe las funciones del rol en tu institución..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2 justify-end text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsNewRoleModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-150 text-[#1C2C35]/60 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-white rounded-xl shadow hover:scale-[1.01] transition-all cursor-pointer"
                  style={{ backgroundColor: activeColor }}
                >
                  Crear Rol
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
