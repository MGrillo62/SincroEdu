'use client';

import { getApiUrl } from '@/lib/config';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Shield, 
  Plus, 
  Save, 
  Info, 
  Check, 
  RefreshCw 
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

export default function RolesConfigPage() {
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

  // Obtener roles al iniciar sesión o cambio de tenant
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
    if (token && tenant) {
      fetchRoles();
    }
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
    <div className="space-y-6">
      
      {/* 1. SECCIÓN DE ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C2C35]">Matriz de Roles y Permisos Dinámicos</h1>
            <p className="text-xs text-slate-400">Configura la seguridad de la escuela autorizando vistas y privilegios CRUD para cada rol del sistema.</p>
          </div>
        </div>

        <button
          onClick={() => setIsNewRoleModalOpen(true)}
          className="px-4 py-2.5 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 hover:scale-[1.01] shadow-md transition-all cursor-pointer"
          style={{ backgroundColor: activeColor }}
        >
          <Plus className="w-4 h-4" />
          Crear Nuevo Rol
        </button>
      </div>

      {/* 2. CORE INTERACTIVO: MATRIZ */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Columna Izquierda: Selector de Roles */}
            <div className="lg:col-span-3 space-y-4">
              <label className="text-xs font-black text-[#1C2C35]/85 uppercase tracking-wider block">
                1. Seleccione un Rol
              </label>
              
              {loadingRoles ? (
                <div className="py-6 text-center text-xs text-slate-450 font-bold flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#6B8E4E]" />
                  Obteniendo roles...
                </div>
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
                        <span className="font-extrabold text-xs md:text-sm block">{role.name}</span>
                        <span className={`text-[10px] mt-1 block truncate max-w-full font-medium ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {role.description || 'Sin descripción.'}
                        </span>
                        
                        {role.isSystemRole && (
                          <span className={`inline-block mt-2.5 self-start px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-555 border border-slate-200'
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
                  <strong>Dinamismo en Vivo:</strong> Cualquier cambio que realices sobre los permisos del menú de la barra lateral se aplicará al instante sobre las sesiones activas de ese rol en el colegio.
                </span>
              </div>
            </div>

            {/* Columna Derecha: Matriz de Permisos */}
            <div className="lg:col-span-9 space-y-5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-[#1C2C35]/85 uppercase tracking-wider block">
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
                    <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-[#1C2C35]/80 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Opción de Menú</th>
                      <th className="py-3.5 px-4 text-center">Ver Menú (Visual)</th>
                      <th className="py-3.5 px-4 text-center">Crear</th>
                      <th className="py-3.5 px-4 text-center">Editar</th>
                      <th className="py-3.5 px-4 text-center">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-[#1C2C35]/80 bg-white">
                    {permissionsConfig.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                          Seleccione un rol de la lista izquierda para cargar permisos.
                        </td>
                      </tr>
                    ) : (
                      permissionsConfig.map((perm) => (
                        <tr key={perm.menuOptionId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-extrabold text-[#1C2C35] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: activeColor }} />
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
                <div className="text-xs font-bold text-green-600">
                  {saveMessage && <span>{saveMessage}</span>}
                </div>
                
                <button
                  onClick={handleSavePermissions}
                  disabled={savingPermissions || !selectedRoleId}
                  className="w-full sm:w-auto px-6 py-3 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  style={{ backgroundColor: activeColor }}
                >
                  {savingPermissions ? (
                    <>
                      <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                      Guardando Permisos...
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

      {/* 3. MODAL: CREACIÓN DE NUEVO ROL */}
      {isNewRoleModalOpen && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            
            <div className="mb-4">
              <h3 className="text-base font-black text-[#1C2C35]">Crear Nuevo Rol Dinámico</h3>
              <p className="text-xs text-slate-405 mt-0.5">
                Registra un rol personalizado para tu colegio y configura sus permisos de menú.
              </p>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block">
                  Nombre del Rol
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: Coordinador, Tutor Académico, Tutor Aux"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-semibold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block">
                  Descripción del Rol
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe las facultades y propósitos del rol..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all resize-none font-semibold text-slate-800"
                />
              </div>

              <div className="flex gap-3 pt-2 justify-end text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsNewRoleModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all cursor-pointer"
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
