'use client';

import { getApiUrl } from '@/lib/config';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import DataTable, { Column } from '@/components/ui/data-table';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  X,
  Mail,
  Phone,
  UserCheck,
  UserX,
  UserPlus,
  KeyRound,
  ShieldCheck,
  Building
} from 'lucide-react';

interface UserItem {
  id: string;
  tenantId: string | null;
  roleId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  roleName: string;
}

interface RoleOption {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
}

export default function UsersConfigPage() {
  const { user: currentUser, tenant, token } = useAuthStore();
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [rolesList, setRolesList] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modales y Formularios
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Campos del formulario
  const [userEmail, setUserEmail] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userRoleId, setUserRoleId] = useState('');
  const [userIsActive, setUserIsActive] = useState(true);

  // Estados de Superadmin
  const [tenantsList, setTenantsList] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // Notificación local
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Cargar lista de Tenants si es Superadmin
  useEffect(() => {
    if (token && currentUser?.roleId === 'r-superadmin') {
      const fetchTenants = async () => {
        try {
          const res = await fetch(`${getApiUrl()}/tenants`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.length > 0) {
            setTenantsList(data);
            setSelectedTenantId(data[0].id);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchTenants();
    }
  }, [token, currentUser]);

  const activeTenantId = currentUser?.roleId === 'r-superadmin'
    ? selectedTenantId
    : tenant?.id;

  // Cargar roles disponibles del Tenant
  const fetchRoles = async () => {
    if (!token || !activeTenantId) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // SEGURIDAD: Filtrar el rol de Superadmin si el usuario logueado NO es Superadmin
        const filteredRoles = data.filter((r: RoleOption) => 
          r.id !== 'r-superadmin' || currentUser?.roleId === 'r-superadmin'
        );
        setRolesList(filteredRoles);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cargar lista de usuarios
  const fetchUsers = async () => {
    if (!token || !activeTenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // SEGURIDAD FRONTEND: Filtrar usuarios con rol Superadmin si el logueado no es Superadmin
        const filteredUsers = data.filter((u: UserItem) => 
          u.roleId !== 'r-superadmin' || currentUser?.roleId === 'r-superadmin'
        );
        setUsersList(filteredUsers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && activeTenantId) {
      fetchUsers();
      fetchRoles();
    }
  }, [token, activeTenantId]);

  // Abrir formulario para crear
  const openCreateForm = () => {
    setEditMode(false);
    setSelectedUser(null);
    setUserEmail('');
    setUserFirstName('');
    setUserLastName('');
    setUserPhone('');
    // Auto-seleccionar primer rol
    if (rolesList.length > 0) {
      setUserRoleId(rolesList[0].id);
    } else {
      setUserRoleId('');
    }
    setUserIsActive(true);
    setIsFormOpen(true);
  };

  // Abrir formulario para editar
  const openEditForm = (u: UserItem) => {
    setEditMode(true);
    setSelectedUser(u);
    setUserEmail(u.email);
    setUserFirstName(u.firstName);
    setUserLastName(u.lastName);
    setUserPhone(u.phone || '');
    setUserRoleId(u.roleId);
    setUserIsActive(u.isActive);
    setIsFormOpen(true);
  };

  // Enviar formulario (Crear / Editar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    const url = editMode 
      ? `${getApiUrl()}/tenants/${activeTenantId}/users/${selectedUser?.id}`
      : `${getApiUrl()}/tenants/${activeTenantId}/users`;
    
    const method = editMode ? 'PUT' : 'POST';
    
    const body = editMode 
      ? { firstName: userFirstName, lastName: userLastName, phone: userPhone || null, roleId: userRoleId, isActive: userIsActive }
      : { email: userEmail, firstName: userFirstName, lastName: userLastName, phone: userPhone || null, roleId: userRoleId, isActive: userIsActive, password: 'sincro123' };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        showNotification(
          editMode ? '¡Usuario actualizado con éxito!' : '¡Usuario creado y registrado exitosamente!',
          'success'
        );
        setIsFormOpen(false);
        fetchUsers();
      } else {
        showNotification(`Error: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Error de red al conectar con el servidor', 'error');
    }
  };

  // Eliminar Usuario
  const handleDeleteUser = async (userId: string) => {
    if (!token || !activeTenantId) return;
    if (userId === currentUser?.id) {
      showNotification('No está permitido eliminarse a sí mismo de la consola escolar.', 'error');
      return;
    }

    if (!confirm('¿Está completamente seguro de eliminar esta cuenta de usuario? Esta acción removerá sus accesos de forma permanente.')) {
      return;
    }

    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        showNotification('Usuario eliminado con éxito.', 'success');
        fetchUsers();
      } else {
        const data = await res.json();
        showNotification(data.error || 'No se pudo eliminar el usuario', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Alternar Estado de Activo / Inactivo Directamente
  const handleToggleStatus = async (u: UserItem) => {
    if (!token || !activeTenantId) return;
    if (u.id === currentUser?.id) {
      showNotification('No puedes inhabilitar tu propia cuenta activa de administrador.', 'error');
      return;
    }

    const newStatus = !u.isActive;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/users/${u.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          roleId: u.roleId,
          isActive: newStatus
        })
      });

      if (res.ok) {
        showNotification(`Usuario ${newStatus ? 'habilitado' : 'inhabilitado'} con éxito.`, 'success');
        fetchUsers();
      } else {
        showNotification('Error al cambiar el estado del usuario', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Color primario de acento dinámico según el Tenant
  const activeColor = currentUser?.roleId === 'r-superadmin'
    ? (tenantsList.find(t => t.id === selectedTenantId)?.primaryColor || '#6B8E4E')
    : (tenant?.primaryColor || '#6B8E4E');

  // Columnas para la DataGrid
  const columns: Column<UserItem>[] = [
    {
      accessor: 'firstName',
      label: 'Usuario',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#1C2C35]">
            {row.firstName[0]}{row.lastName[0]}
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-800 text-xs md:text-sm">{row.firstName} {row.lastName}</span>
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {row.email}
            </span>
          </div>
        </div>
      )
    },
    {
      accessor: 'roleName',
      label: 'Rol Asignado',
      sortable: true,
      render: (row) => (
        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
          {row.roleName}
        </span>
      )
    },
    {
      accessor: 'phone',
      label: 'Teléfono',
      render: (row) => (
        <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
          {row.phone ? (
            <>
              <Phone className="w-3 h-3 text-slate-400" />
              {row.phone}
            </>
          ) : (
            <span className="text-slate-350 italic">No registrado</span>
          )}
        </span>
      )
    },
    {
      accessor: 'isActive',
      label: 'Estado Cuenta',
      sortable: true,
      render: (row) => (
        <button
          onClick={() => handleToggleStatus(row)}
          className={`px-3 py-1 rounded-full text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
            row.isActive 
              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
          }`}
        >
          {row.isActive ? (
            <>
              <UserCheck className="w-3 h-3 text-green-600" />
              Habilitado
            </>
          ) : (
            <>
              <UserX className="w-3 h-3 text-rose-600" />
              Inactivo
            </>
          )}
        </button>
      )
    },
    {
      accessor: 'id',
      label: 'Acciones',
      render: (row) => (
        <div className="flex gap-2">
          <button 
            onClick={() => openEditForm(row)}
            className="p-1.5 hover:bg-[#6B8E4E]/10 rounded-xl text-[#6B8E4E] cursor-pointer flex items-center gap-1 font-semibold text-xs"
            style={{ color: activeColor }}
          >
            <Edit3 className="w-4 h-4" />
            Editar
          </button>
          <button 
            onClick={() => handleDeleteUser(row.id)}
            disabled={row.id === currentUser?.id}
            className="p-1.5 hover:bg-rose-55 text-rose-600 rounded-xl cursor-pointer flex items-center gap-1 font-semibold text-xs disabled:opacity-30 disabled:pointer-events-none"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Toast notifications */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[9999] p-4 rounded-2xl shadow-xl border flex items-start gap-3 w-80 animate-slide-in backdrop-blur-md ${
          notification.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-rose-500/90 text-white border-rose-400'
        }`}>
          <CheckCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold">{notification.type === 'success' ? 'Éxito' : 'Error'}</h4>
            <p className="opacity-90">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="ml-auto text-white hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTOR EXCLUSIVO SUPERADMIN: SELECCIONAR ESCUELA */}
      {currentUser?.roleId === 'r-superadmin' && tenantsList.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in shadow-inner">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Consola Global de Superadmin</span>
            <span className="text-xs font-bold text-[#1C2C35] flex items-center gap-1.5">
              <Building className="w-4 h-4 text-slate-500" />
              Selecciona la institución para ver o gestionar sus usuarios:
            </span>
          </div>
          <select
            value={selectedTenantId}
            onChange={e => setSelectedTenantId(e.target.value)}
            className="w-full sm:w-72 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-black text-[#1C2C35] bg-white focus:outline-none focus:border-[#6B8E4E] shadow-sm cursor-pointer"
          >
            {tenantsList.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.subdomain})</option>
            ))}
          </select>
        </div>
      )}

      {/* Encabezado del Módulo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <Users className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C2C35]">Gestión y Cuentas de Usuarios</h1>
            <p className="text-xs text-slate-400">Registra al personal escolar, modula sus estados de actividad y asigna perfiles de seguridad.</p>
          </div>
        </div>

        <button 
          onClick={openCreateForm}
          className="px-4 py-2.5 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 hover:scale-[1.01] shadow-md transition-all cursor-pointer"
          style={{ backgroundColor: activeColor }}
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Tarjetas de Resumen Rápido (Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Cuentas</span>
            <span className="text-lg font-black text-slate-800">{usersList.length} registrados</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cuentas Activas</span>
            <span className="text-lg font-black text-slate-800">{usersList.filter(u => u.isActive).length} accesos hábiles</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Inhabilitados</span>
            <span className="text-lg font-black text-slate-800">{usersList.filter(u => !u.isActive).length} bloqueados</span>
          </div>
        </div>
      </div>

      {/* Grid Principal con Tabla Ordenable */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B8E4E] mb-2" />
            Sincronizando registros escolares...
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={usersList} 
            searchPlaceholder="Buscar por nombre de usuario o email..."
            searchAccessor="firstName"
          />
        )}
      </div>

      {/* Formulario Modal Crear / Editar */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-[#1C2C35] flex items-center gap-2">
                  {editMode ? 'Modificar Ficha de Usuario' : 'Agregar Nuevo Usuario Académico'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Registra o actualiza el correo escolar, nombres y perfil de acceso del usuario.
                </p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-[#1C2C35] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email (Deshabilitado en Edición) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Correo Electrónico (Login ID)</label>
                <input 
                  type="email"
                  required
                  disabled={editMode}
                  placeholder="ej: nombre.apellido@colegiopremium.edu"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all disabled:opacity-50 font-semibold"
                />
              </div>

              {/* Nombres y Apellidos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Nombres</label>
                  <input 
                    type="text"
                    required
                    placeholder="ej: Patricia"
                    value={userFirstName}
                    onChange={(e) => setUserFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-semibold"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Apellidos</label>
                  <input 
                    type="text"
                    required
                    placeholder="ej: Ruiz Paredes"
                    value={userLastName}
                    onChange={(e) => setUserLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Teléfono */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Número Telefónico</label>
                  <input 
                    type="text"
                    placeholder="ej: +51 987 654 321"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-semibold"
                  />
                </div>

                {/* Rol de Acceso */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Rol y Nivel de Seguridad</label>
                  <select
                    value={userRoleId}
                    required
                    onChange={(e) => setUserRoleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer font-semibold"
                  >
                    {rolesList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">Estado de cuenta Activo</span>
                  <span className="text-[10px] text-slate-400">Si se inactiva, el usuario perderá acceso inmediato al portal.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUserIsActive(!userIsActive)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none ${
                    userIsActive ? 'bg-[#6B8E4E]' : 'bg-slate-300'
                  }`}
                  style={userIsActive ? { backgroundColor: activeColor } : undefined}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white shadow transform duration-200 ease-in-out ${
                      userIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Password Default Note */}
              {!editMode && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-indigo-800 leading-normal font-semibold">
                    <span className="font-extrabold uppercase block text-indigo-900 mb-0.5">Seguridad Credencial:</span>
                    La contraseña inicial temporal para este nuevo usuario será <code className="bg-white/80 px-1 py-0.5 rounded text-slate-800 font-extrabold text-[9px]">sincro123</code>. Deberá cambiarla al primer inicio de sesión.
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-white rounded-xl shadow hover:scale-[1.01] transition-all cursor-pointer"
                  style={{ backgroundColor: activeColor }}
                >
                  {editMode ? 'Guardar Cambios' : 'Registrar Cuenta'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
