'use client';

import { getApiUrl } from '@/lib/config';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import DataTable, { Column } from '@/components/ui/data-table';
import SelectSearch from '@/components/ui/select-search';
import { 
  Users, 
  Plus, 
  History, 
  Edit3, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  RefreshCw,
  X,
  PlusCircle,
  GraduationCap
} from 'lucide-react';

interface Professor {
  id: string;
  userId: string;
  specialty: string;
  hireDate: string;
  status: 'active' | 'license' | 'inactive';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
}

interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE';
  changedBy: string;
  previousValues: any | null;
  newValues: any | null;
  createdAt: string;
}

export default function ProfessorsPage() {
  const { tenant, token } = useAuthStore();
  const [profsList, setProfsList] = useState<Professor[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedProf, setSelectedProf] = useState<Professor | null>(null);
  const [historyList, setHistoryList] = useState<AuditLog[]>([]);

  // Campos
  const [userIdSelect, setUserIdSelect] = useState('');
  const [profSpecialty, setProfSpecialty] = useState('');
  const [profHireDate, setProfHireDate] = useState('');
  const [profStatus, setProfStatus] = useState<'active' | 'license' | 'inactive'>('active');
  const [editMode, setEditMode] = useState(false);

  // Cargar Profesores
  const fetchProfessors = async () => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/professors`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setProfsList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar todos los usuarios para el Autocomplete del Docente
  const fetchUsers = async () => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      // Usaremos la sesión del store o simulamos los usuarios disponibles
      // En nuestro db.ts creamos: Mateo Silva, Laura Vegas, Patricia Ruiz, etc.
      // Vamos a mapear los usuarios del Tenant 1 para poder asociarlos a profesor
      const res = await fetch(`${getApiUrl()}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Simulamos la lista basada en los usuarios de prueba guardados en el mock
      const mockUsers = [
        { value: 'u-t1professor', label: 'Mateo Silva (profesor@colegiopremium.edu)' },
        { value: 'u-t1auxiliar', label: 'Laura Vegas (auxiliar@colegiopremium.edu)' },
        { value: 'u-t1admin', label: 'Patricia Ruiz (admin@colegiopremium.edu)' }
      ];
      setAvailableUsers(mockUsers);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfessors();
      fetchUsers();
    }
  }, [token, tenant]);

  // Formateador de Fechas a DD/MM/AAAA
  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    // Soporta tanto yyyy-mm-dd como formatos ISO completos
    const date = new Date(isoString.includes('T') ? isoString : `${isoString}T12:00:00`);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Cargar Historial
  const openHistory = async (prof: Professor) => {
    setSelectedProf(prof);
    setIsHistoryOpen(true);
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/professors/${prof.id}/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setHistoryList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Abrir Formulario
  const openCreateForm = () => {
    setEditMode(false);
    setUserIdSelect('');
    setProfSpecialty('');
    setProfHireDate(new Date().toISOString().split('T')[0]);
    setProfStatus('active');
    setIsFormOpen(true);
  };

  const openEditForm = (prof: Professor) => {
    setEditMode(true);
    setSelectedProf(prof);
    setUserIdSelect(prof.userId);
    setProfSpecialty(prof.specialty);
    setProfHireDate(prof.hireDate);
    setProfStatus(prof.status);
    setIsFormOpen(true);
  };

  // Enviar Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;

    const url = editMode 
      ? `${getApiUrl()}/tenants/${activeTenantId}/professors/${selectedProf?.id}`
      : `${getApiUrl()}/tenants/${activeTenantId}/professors`;
    
    const method = editMode ? 'PUT' : 'POST';
    const body = editMode 
      ? { specialty: profSpecialty, hireDate: profHireDate }
      : { userId: userIdSelect, specialty: profSpecialty, hireDate: profHireDate, status: profStatus };

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
        setIsFormOpen(false);
        fetchProfessors();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al procesar facultad');
    }
  };

  // Cambiar Estado Directamente
  const handleStatusChange = async (prof: Professor, newStatus: 'active' | 'license' | 'inactive') => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/professors/${prof.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchProfessors();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Columnas para la DataTable
  const columns: Column<Professor>[] = [
    {
      accessor: 'name',
      label: 'Docente / Perfil',
      sortable: true,
      render: (row) => {
        const name = row.user ? `${row.user.firstName} ${row.user.lastName}` : 'Docente Invitado';
        const email = row.user?.email || '-';
        const avatar = row.user?.avatarUrl;
        
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
              {avatar ? (
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xs bg-slate-100 text-slate-500 uppercase">
                  {name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-800">{name}</span>
              <span className="text-[10px] text-slate-400">{email}</span>
            </div>
          </div>
        );
      }
    },
    {
      accessor: 'specialty',
      label: 'Especialidad Curricular',
      sortable: true,
      render: (row) => <span className="font-semibold text-slate-650">{row.specialty}</span>
    },
    {
      accessor: 'hireDate',
      label: 'Fecha de Contrato',
      sortable: true,
      render: (row) => <span>{formatDate(row.hireDate)}</span>
    },
    {
      accessor: 'status',
      label: 'Estado',
      sortable: true,
      render: (row) => {
        const statusColors = {
          active: 'bg-green-100 text-green-800 border-green-200',
          license: 'bg-amber-100 text-amber-800 border-amber-200',
          inactive: 'bg-red-100 text-red-800 border-red-200'
        };

        return (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[row.status]}`}>
              {row.status === 'active' ? 'Vigente' : row.status === 'license' ? 'Licencia' : 'De Baja'}
            </span>
            
            <div className="flex gap-1">
              {row.status !== 'active' && (
                <button 
                  onClick={() => handleStatusChange(row, 'active')}
                  title="Activar Profesor"
                  className="p-1 hover:bg-slate-100 rounded text-green-600 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'license' && (
                <button 
                  onClick={() => handleStatusChange(row, 'license')}
                  title="Marcar con Licencia Temporal"
                  className="p-1 hover:bg-slate-100 rounded text-amber-600 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'inactive' && (
                <button 
                  onClick={() => handleStatusChange(row, 'inactive')}
                  title="Marcar como Inactivo (De baja)"
                  className="p-1 hover:bg-slate-100 rounded text-red-500 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      }
    },
    {
      accessor: 'acciones',
      label: 'Acciones',
      render: (row) => (
        <div className="flex gap-2">
          <button 
            onClick={() => openEditForm(row)}
            className="p-1.5 hover:bg-[#6B8E4E]/10 rounded-xl text-[#6B8E4E] cursor-pointer flex items-center gap-1 font-semibold"
          >
            <Edit3 className="w-4 h-4" />
            Editar
          </button>
          <button 
            onClick={() => openHistory(row)}
            className="p-1.5 hover:bg-indigo-50 rounded-xl text-indigo-500 cursor-pointer flex items-center gap-1 font-semibold"
          >
            <History className="w-4 h-4" />
            Historial
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1C2C35]">Gestión de Facultad (Profesores)</h1>
            <p className="text-xs text-slate-400">Control de perfiles docentes, asignaciones académicas e historial de vigencia.</p>
          </div>
        </div>

        <button 
          onClick={openCreateForm}
          className="px-4 py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-semibold text-xs rounded-xl flex items-center gap-2 hover:scale-[1.01] shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Profesor
        </button>
      </div>

      {/* Tabla principal */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B8E4E] mb-2" />
            Cargando planta docente...
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={profsList} 
            searchPlaceholder="Buscar por especialidad..."
            searchAccessor="specialty"
          />
        )}
      </div>

      {/* MODAL FORMULARIO */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1C2C35]">
                  {editMode ? 'Editar Perfil Docente' : 'Registrar Miembro de Facultad'}
                </h3>
                <p className="text-xs text-slate-400">
                  Asocia un usuario de la institución y detalla su contrato y especialidad.
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
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                  Buscar Usuario en la Institución (Autocomplete)
                </label>
                {editMode ? (
                  <input
                    type="text"
                    disabled
                    value={availableUsers.find(u => u.value === userIdSelect)?.label || 'Usuario asignado'}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-100 outline-none opacity-60"
                  />
                ) : (
                  // SelectSearch con Autocomplete interactivo (permite escritura!)
                  <SelectSearch 
                    options={availableUsers}
                    value={userIdSelect}
                    onChange={setUserIdSelect}
                    placeholder="Escribe correo o nombre para buscar..."
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                    Fecha de Contratación
                  </label>
                  <input 
                    type="date"
                    required
                    value={profHireDate}
                    onChange={(e) => setProfHireDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer"
                  />
                </div>

                {!editMode && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                      Estado Inicial
                    </label>
                    <select
                      value={profStatus}
                      onChange={(e) => setProfStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="active">Activo (Vigente)</option>
                      <option value="license">Licencia Temporal</option>
                      <option value="inactive">Baja Definitiva</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                  Especialidad / Área Curricular
                </label>
                <input 
                  type="text"
                  required
                  placeholder="ej: Ciencias Físico-Matemáticas, Lengua Inglesa"
                  value={profSpecialty}
                  onChange={(e) => setProfSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-150 text-[#1C2C35]/60 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white rounded-xl shadow hover:scale-[1.01] transition-all cursor-pointer"
                >
                  {editMode ? 'Guardar Cambios' : 'Registrar Profesor'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL HISTORIAL AUDITORÍA */}
      {isHistoryOpen && selectedProf && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up max-h-[85vh] flex flex-col">
            
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-lg font-bold text-[#1C2C35]">Historial de Trazabilidad Docente</h3>
                  <p className="text-xs text-slate-400">
                    Cambios en contratos, licencias y especialidades del docente: <strong className="text-slate-700">{selectedProf.user?.firstName} {selectedProf.user?.lastName}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-[#1C2C35] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4 select-none">
              {historyList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No hay trazas registradas para este miembro de facultad.
                </div>
              ) : (
                historyList.map((log) => (
                  <div key={log.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative space-y-2">
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200/50">
                      <div className="flex items-center gap-2">
                        {log.action === 'CREATE' ? (
                          <span className="px-2 py-0.5 bg-green-150 text-green-800 rounded font-bold text-[9px] uppercase">REGISTRO</span>
                        ) : log.action === 'STATUS_CHANGE' ? (
                          <span className="px-2 py-0.5 bg-amber-150 text-amber-800 rounded font-bold text-[9px] uppercase">CAMBIO VIGENCIA</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-150 text-blue-800 rounded font-bold text-[9px] uppercase">ACTUALIZACIÓN</span>
                        )}
                        <span className="text-[10px] text-slate-400">{formatDate(log.createdAt)} a las {new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      
                      <span className="text-[10px] font-bold text-slate-500">
                        Auditor: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 text-[9px]">{log.changedBy}</code>
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 leading-relaxed mt-2 space-y-1">
                      {log.action === 'CREATE' && (
                        <p>Docente registrado formalmente en la planta de la escuela. Fecha inicial de ingreso: <strong>{formatDate(log.newValues?.hireDate)}</strong>. Especialidad curricular: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-semibold">{log.newValues?.specialty}</code>.</p>
                      )}

                      {log.action === 'STATUS_CHANGE' && (
                        <p>Vigencia cambiada de <span className="line-through text-red-500">{log.previousValues?.status === 'active' ? 'Vigente' : log.previousValues?.status === 'license' ? 'Licencia' : 'De Baja'}</span> a <strong className="text-green-600 font-bold">{log.newValues?.status === 'active' ? 'Vigente' : log.newValues?.status === 'license' ? 'Licencia' : 'De Baja'}</strong>.</p>
                      )}

                      {log.action === 'UPDATE' && (
                        <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-100 shadow-inner">
                          <p className="font-bold text-[9px] text-slate-400 uppercase tracking-wide">Modificaciones Contractuales/Área:</p>
                          {Object.keys(log.newValues || {}).map(field => {
                            if (field === 'updatedAt') return null;
                            const prev = log.previousValues?.[field];
                            const curr = log.newValues?.[field];
                            if (JSON.stringify(prev) === JSON.stringify(curr)) return null;

                            return (
                              <div key={field} className="grid grid-cols-6 gap-2 text-[10px]">
                                <span className="font-bold uppercase text-slate-400 col-span-1 shrink-0">{field === 'hireDate' ? 'Contrato' : 'Especialidad'}:</span>
                                <span className="col-span-5">
                                  Cambió de <span className="line-through text-red-500">{field === 'hireDate' ? formatDate(prev) : prev}</span> a <strong className="text-slate-850">{field === 'hireDate' ? formatDate(curr) : curr}</strong>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#1C2C35]/75 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
