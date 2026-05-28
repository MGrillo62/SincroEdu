'use client';

import { getApiUrl } from '@/lib/config';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import DataTable, { Column } from '@/components/ui/data-table';
import { 
  Building, 
  Plus, 
  History, 
  Edit3, 
  CheckCircle, 
  Wrench, 
  XSquare, 
  RefreshCw,
  X,
  MapPin,
  Globe,
  PlusCircle
} from 'lucide-react';

interface Campus {
  id: string;
  name: string;
  address: string;
  type: 'physical' | 'virtual';
  capacity: number;
  status: 'active' | 'maintenance' | 'closed';
  createdAt: string;
  updatedAt: string;
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

export default function CampusesPage() {
  const { tenant, token } = useAuthStore();
  const [campusesList, setCampusesList] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(false);

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [historyList, setHistoryList] = useState<AuditLog[]>([]);

  // Campos
  const [campusName, setCampusName] = useState('');
  const [campusAddress, setCampusAddress] = useState('');
  const [campusType, setCampusType] = useState<'physical' | 'virtual'>('physical');
  const [campusCapacity, setCampusCapacity] = useState(100);
  const [campusStatus, setCampusStatus] = useState<'active' | 'maintenance' | 'closed'>('active');
  const [editMode, setEditMode] = useState(false);

  // Cargar sedes
  const fetchCampuses = async () => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/campuses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setCampusesList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCampuses();
    }
  }, [token, tenant]);

  // Formateador de Fechas a DD/MM/AAAA
  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Cargar Historial
  const openHistory = async (campus: Campus) => {
    setSelectedCampus(campus);
    setIsHistoryOpen(true);
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/campuses/${campus.id}/history`, {
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
    setCampusName('');
    setCampusAddress('');
    setCampusType('physical');
    setCampusCapacity(100);
    setCampusStatus('active');
    setIsFormOpen(true);
  };

  const openEditForm = (campus: Campus) => {
    setEditMode(true);
    setSelectedCampus(campus);
    setCampusName(campus.name);
    setCampusAddress(campus.address);
    setCampusType(campus.type);
    setCampusCapacity(campus.capacity);
    setCampusStatus(campus.status);
    setIsFormOpen(true);
  };

  // Enviar Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;

    const url = editMode 
      ? `${getApiUrl()}/tenants/${activeTenantId}/campuses/${selectedCampus?.id}`
      : `${getApiUrl()}/tenants/${activeTenantId}/campuses`;
    
    const method = editMode ? 'PUT' : 'POST';
    const body = editMode 
      ? { name: campusName, address: campusAddress, capacity: campusCapacity }
      : { name: campusName, address: campusAddress, type: campusType, capacity: campusCapacity, status: campusStatus };

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
        fetchCampuses();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al procesar sede');
    }
  };

  // Cambiar Estado Directamente
  const handleStatusChange = async (campus: Campus, newStatus: 'active' | 'maintenance' | 'closed') => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/campuses/${campus.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchCampuses();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Columnas para DataTable
  const columns: Column<Campus>[] = [
    {
      accessor: 'name',
      label: 'Nombre de la Sede / Espacio',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-[#6B8E4E]">
            {row.type === 'physical' ? (
              <MapPin className="w-5 h-5" />
            ) : (
              <Globe className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800">{row.name}</span>
            <span className="text-[10px] text-slate-400 truncate max-w-xs">{row.address}</span>
          </div>
        </div>
      )
    },
    {
      accessor: 'type',
      label: 'Tipo de Entorno',
      sortable: true,
      render: (row) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          row.type === 'physical' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'
        }`}>
          {row.type === 'physical' ? 'Física' : 'Virtual'}
        </span>
      )
    },
    {
      accessor: 'capacity',
      label: 'Aforo Máximo',
      sortable: true,
      render: (row) => <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{row.capacity} Alumnos</span>
    },
    {
      accessor: 'status',
      label: 'Estado Operativo',
      sortable: true,
      render: (row) => {
        const statusColors = {
          active: 'bg-green-100 text-green-800 border-green-200',
          maintenance: 'bg-amber-100 text-amber-800 border-amber-200',
          closed: 'bg-red-100 text-red-800 border-red-200'
        };

        return (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[row.status]}`}>
              {row.status === 'active' ? 'Operativo' : row.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo'}
            </span>
            
            <div className="flex gap-1">
              {row.status !== 'active' && (
                <button 
                  onClick={() => handleStatusChange(row, 'active')}
                  title="Activar Sede"
                  className="p-1 hover:bg-slate-100 rounded text-green-600 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'maintenance' && (
                <button 
                  onClick={() => handleStatusChange(row, 'maintenance')}
                  title="Marcar en Mantenimiento"
                  className="p-1 hover:bg-slate-100 rounded text-amber-600 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'closed' && (
                <button 
                  onClick={() => handleStatusChange(row, 'closed')}
                  title="Cerrar Sede"
                  className="p-1 hover:bg-slate-100 rounded text-red-500 cursor-pointer"
                >
                  <XSquare className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      }
    },
    {
      accessor: 'createdAt',
      label: 'Fecha Creación',
      sortable: true,
      render: (row) => <span>{formatDate(row.createdAt)}</span>
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
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1C2C35]">Sedes</h1>
            <p className="text-xs text-slate-400">Control de campus físicos, laboratorios virtuales, capacidades aforo e historial de mantenimiento.</p>
          </div>
        </div>

        <button 
          onClick={openCreateForm}
          className="px-4 py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-semibold text-xs rounded-xl flex items-center gap-2 hover:scale-[1.01] shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nueva Sede
        </button>
      </div>

      {/* Tabla principal */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B8E4E] mb-2" />
            Sincronizando infraestructura...
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={campusesList} 
            searchPlaceholder="Buscar por nombre..."
            searchAccessor="name"
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
                  {editMode ? 'Editar Infraestructura' : 'Registrar Nueva Sede / Entorno'}
                </h3>
                <p className="text-xs text-slate-400">
                  Agrega nuevos entornos para dictar clases y administrar aforo.
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
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                    Nombre del Campus / Aula
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="ej: Sede Norte - Auditorio"
                    value={campusName}
                    onChange={(e) => setCampusName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                    Tipo
                  </label>
                  <select
                    disabled={editMode}
                    value={campusType}
                    onChange={(e) => setCampusType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer disabled:opacity-55"
                  >
                    <option value="physical">Físico</option>
                    <option value="virtual">Virtual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                    Capacidad / Aforo Máx
                  </label>
                  <input 
                    type="number"
                    min={5}
                    max={10000}
                    required
                    value={campusCapacity}
                    onChange={(e) => setCampusCapacity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all"
                  />
                </div>

                {!editMode && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                      Estado Operativo
                    </label>
                    <select
                      value={campusStatus}
                      onChange={(e) => setCampusStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="active">Operativo</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="closed">Inactivo</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                  {campusType === 'physical' ? 'Dirección Física Sede' : 'Enlace / URL del Campus Virtual'}
                </label>
                <input 
                  type="text"
                  required
                  placeholder={campusType === 'physical' ? 'ej: Av. Javier Prado 2500, Lince' : 'ej: https://zoom.us/j/12345'}
                  value={campusAddress}
                  onChange={(e) => setCampusAddress(e.target.value)}
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
                  {editMode ? 'Guardar Cambios' : 'Registrar Sede'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL HISTORIAL AUDITORÍA */}
      {isHistoryOpen && selectedCampus && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up max-h-[85vh] flex flex-col">
            
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-lg font-bold text-[#1C2C35]">Historial de Trazabilidad de Sedes</h3>
                  <p className="text-xs text-slate-400">
                    Control de cambios de aforo y mantenimiento del espacio: <strong className="text-slate-700">{selectedCampus.name}</strong>
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
                  No hay trazas de cambios registradas para este entorno.
                </div>
              ) : (
                historyList.map((log) => (
                  <div key={log.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative space-y-2">
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200/50">
                      <div className="flex items-center gap-2">
                        {log.action === 'CREATE' ? (
                          <span className="px-2 py-0.5 bg-green-150 text-green-800 rounded font-bold text-[9px] uppercase">CREACIÓN</span>
                        ) : log.action === 'STATUS_CHANGE' ? (
                          <span className="px-2 py-0.5 bg-amber-150 text-amber-800 rounded font-bold text-[9px] uppercase">CAMBIO ESTADO</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-150 text-blue-800 rounded font-bold text-[9px] uppercase">MODIFICACIÓN</span>
                        )}
                        <span className="text-[10px] text-slate-400">{formatDate(log.createdAt)} a las {new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      
                      <span className="text-[10px] font-bold text-slate-500">
                        Usuario Auditor: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 text-[9px]">{log.changedBy}</code>
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 leading-relaxed mt-2 space-y-1">
                      {log.action === 'CREATE' && (
                        <p>Infraestructura registrada. Nombre original: <strong className="text-slate-800">{log.newValues?.name}</strong> de tipo <strong className="text-slate-800">{log.newValues?.type === 'physical' ? 'Físico' : 'Virtual'}</strong> con aforo curricular habilitado para <code className="bg-slate-200 px-1 py-0.5 rounded font-bold text-slate-800">{log.newValues?.capacity} alumnos</code>.</p>
                      )}

                      {log.action === 'STATUS_CHANGE' && (
                        <p>Estado operativo cambiado de <span className="line-through text-red-500">{log.previousValues?.status === 'active' ? 'Operativo' : log.previousValues?.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo'}</span> a <strong className="text-green-600 font-bold">{log.newValues?.status === 'active' ? 'Operativo' : log.newValues?.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo'}</strong>.</p>
                      )}

                      {log.action === 'UPDATE' && (
                        <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-100 shadow-inner">
                          <p className="font-bold text-[9px] text-slate-400 uppercase tracking-wide">Campos de Infraestructura Alterados:</p>
                          {Object.keys(log.newValues || {}).map(field => {
                            if (field === 'updatedAt') return null;
                            const prev = log.previousValues?.[field];
                            const curr = log.newValues?.[field];
                            if (JSON.stringify(prev) === JSON.stringify(curr)) return null;

                            return (
                              <div key={field} className="grid grid-cols-6 gap-2 text-[10px]">
                                <span className="font-bold uppercase text-slate-400 col-span-1 shrink-0">{field === 'name' ? 'Nombre' : field === 'capacity' ? 'Aforo' : 'Dirección'}:</span>
                                <span className="col-span-5">
                                  Cambió de <span className="line-through text-red-500">{prev}</span> a <strong className="text-slate-850">{curr}</strong>
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
