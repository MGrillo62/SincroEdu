'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import DataTable, { Column } from '@/components/ui/data-table';
import { 
  BookOpen, 
  Plus, 
  History, 
  Edit3, 
  CheckCircle, 
  Clock, 
  Archive, 
  RefreshCw,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

interface Course {
  id: string;
  code: string;
  name: string;
  description: string;
  credits: number;
  status: 'draft' | 'active' | 'archived';
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

export default function CoursesPage() {
  const { tenant, token } = useAuthStore();
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modales y Formularios
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [historyList, setHistoryList] = useState<AuditLog[]>([]);
  
  // Campos del formulario
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseCredits, setCourseCredits] = useState(3);
  const [courseStatus, setCourseStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [editMode, setEditMode] = useState(false);

  // Cargar cursos de la API
  const fetchCourses = async () => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tenants/${activeTenantId}/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setCoursesList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCourses();
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

  // Cargar Historial de Auditoría
  const openHistory = async (course: Course) => {
    setSelectedCourse(course);
    setIsHistoryOpen(true);
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:4000/api/tenants/${activeTenantId}/courses/${course.id}/history`, {
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

  // Abrir formulario para crear
  const openCreateForm = () => {
    setEditMode(false);
    setCourseCode('');
    setCourseName('');
    setCourseDesc('');
    setCourseCredits(3);
    setCourseStatus('draft');
    setIsFormOpen(true);
  };

  // Abrir formulario para editar
  const openEditForm = (course: Course) => {
    setEditMode(true);
    setSelectedCourse(course);
    setCourseCode(course.code);
    setCourseName(course.name);
    setCourseDesc(course.description);
    setCourseCredits(course.credits);
    setCourseStatus(course.status);
    setIsFormOpen(true);
  };

  // Enviar formulario (Crear / Editar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;

    const url = editMode 
      ? `http://localhost:4000/api/tenants/${activeTenantId}/courses/${selectedCourse?.id}`
      : `http://localhost:4000/api/tenants/${activeTenantId}/courses`;
    
    const method = editMode ? 'PUT' : 'POST';
    const body = editMode 
      ? { name: courseName, description: courseDesc, credits: courseCredits }
      : { code: courseCode, name: courseName, description: courseDesc, credits: courseCredits, status: courseStatus };

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
        fetchCourses();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al procesar el curso');
    }
  };

  // Actualizar Estado Directamente
  const handleStatusChange = async (course: Course, newStatus: 'draft' | 'active' | 'archived') => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:4000/api/tenants/${activeTenantId}/courses/${course.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchCourses();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Definir Columnas para la Data-Grid Ordenable
  const columns: Column<Course>[] = [
    {
      accessor: 'code',
      label: 'Código',
      sortable: true,
      render: (row) => <span className="font-bold text-slate-800">{row.code}</span>
    },
    {
      accessor: 'name',
      label: 'Nombre del Curso',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700">{row.name}</span>
          <span className="text-[10px] text-slate-400 truncate max-w-xs">{row.description || 'Sin descripción'}</span>
        </div>
      )
    },
    {
      accessor: 'credits',
      label: 'Créditos',
      sortable: true,
      render: (row) => <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{row.credits} cr</span>
    },
    {
      accessor: 'status',
      label: 'Estado del Curso',
      sortable: true,
      render: (row) => {
        const statusColors = {
          draft: 'bg-amber-100 text-amber-800 border-amber-200',
          active: 'bg-green-100 text-green-800 border-green-200',
          archived: 'bg-slate-100 text-slate-800 border-slate-200'
        };

        return (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[row.status]}`}>
              {row.status === 'draft' ? 'Borrador' : row.status === 'active' ? 'Activo' : 'Archivado'}
            </span>
            
            {/* Opciones rápidas de cambio de estado */}
            <div className="flex gap-1">
              {row.status !== 'active' && (
                <button 
                  onClick={() => handleStatusChange(row, 'active')}
                  title="Marcar como Activo"
                  className="p-1 hover:bg-slate-100 rounded text-green-600 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'draft' && (
                <button 
                  onClick={() => handleStatusChange(row, 'draft')}
                  title="Marcar como Borrador"
                  className="p-1 hover:bg-slate-100 rounded text-amber-600 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'archived' && (
                <button 
                  onClick={() => handleStatusChange(row, 'archived')}
                  title="Marcar como Archivado"
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      }
    },
    {
      accessor: 'updatedAt',
      label: 'Última Edición',
      sortable: true,
      render: (row) => <span>{formatDate(row.updatedAt)}</span>
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
      
      {/* Encabezado del Módulo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1C2C35]">Catálogo de Cursos y Oferta Curricular</h1>
            <p className="text-xs text-slate-400">Administra la malla académica, planes de estudio y vigencia de materias.</p>
          </div>
        </div>

        <button 
          onClick={openCreateForm}
          className="px-4 py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-semibold text-xs rounded-xl flex items-center gap-2 hover:scale-[1.01] shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Curso
        </button>
      </div>

      {/* Grid General con Data-Table Ordenable */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B8E4E] mb-2" />
            Sincronizando catálogo académico...
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={coursesList} 
            searchPlaceholder="Buscar por nombre de materia..."
            searchAccessor="name"
          />
        )}
      </div>

      {/* 5. DIÁLOGO FORMULARIO (CREAR / EDITAR) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1C2C35]">
                  {editMode ? 'Editar Materia Académica' : 'Agregar Nueva Materia al Plan'}
                </h3>
                <p className="text-xs text-slate-400">
                  Completa los campos curriculares para programar la oferta del campus.
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
                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                    Código de Curso
                  </label>
                  <input 
                    type="text"
                    required
                    disabled={editMode}
                    placeholder="ej: MAT-202"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all disabled:opacity-50"
                  />
                </div>
                
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                    Nombre del Curso
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="ej: Geometría Analítica Aplicada"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                    Créditos Curriculares
                  </label>
                  <input 
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={courseCredits}
                    onChange={(e) => setCourseCredits(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all"
                  />
                </div>

                {!editMode && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                      Estado Inicial
                    </label>
                    <select
                      value={courseStatus}
                      onChange={(e) => setCourseStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="draft">Borrador (Planificación)</option>
                      <option value="active">Activo (Oferta Abierta)</option>
                      <option value="archived">Archivado (Cerrado)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">
                  Descripción Curricular
                </label>
                <textarea
                  rows={4}
                  placeholder="Detalla las competencias, objetivos de aprendizaje y sumilla del curso..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all resize-none"
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
                  {editMode ? 'Guardar Cambios' : 'Registrar Curso'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 6. MODAL: TRAZA DE AUDITORÍA / HISTORIAL DE EDICIONES Y ESTADOS */}
      {isHistoryOpen && selectedCourse && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up max-h-[85vh] flex flex-col">
            
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-lg font-bold text-[#1C2C35]">Historial de Ediciones y Trazabilidad</h3>
                  <p className="text-xs text-slate-400">
                    Traza completa de cambios, auditoría de estados y modificaciones para: <strong className="text-slate-700">{selectedCourse.name} ({selectedCourse.code})</strong>
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

            {/* Listado de Auditorías */}
            <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4 select-none">
              {historyList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No hay trazas registradas para esta materia.
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
                          <span className="px-2 py-0.5 bg-blue-150 text-blue-800 rounded font-bold text-[9px] uppercase">EDICIÓN</span>
                        )}
                        <span className="text-[10px] text-slate-400">{formatDate(log.createdAt)} a las {new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      
                      <span className="text-[10px] font-bold text-slate-500">
                        Usuario: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 text-[9px]">{log.changedBy}</code>
                      </span>
                    </div>

                    {/* Mostrar diferencias de campos */}
                    <div className="text-xs text-slate-600 leading-relaxed font-sans mt-2 space-y-1">
                      {log.action === 'CREATE' && (
                        <p>Registro creado con código inicial <code className="bg-slate-200/80 px-1 py-0.5 rounded font-bold text-slate-800">{log.newValues?.code}</code> con créditos curriculares asignados en <strong className="text-slate-800">{log.newValues?.credits} cr</strong>.</p>
                      )}

                      {log.action === 'STATUS_CHANGE' && (
                        <p>Estado cambiado de <span className="line-through text-red-500">{log.previousValues?.status === 'draft' ? 'Borrador' : log.previousValues?.status === 'active' ? 'Activo' : 'Archivado'}</span> a <strong className="text-green-600 font-bold">{log.newValues?.status === 'draft' ? 'Borrador' : log.newValues?.status === 'active' ? 'Activo' : 'Archivado'}</strong>.</p>
                      )}

                      {log.action === 'UPDATE' && (
                        <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-100 shadow-inner">
                          <p className="font-bold text-[9px] text-slate-400 uppercase tracking-wide">Detalle de Modificaciones:</p>
                          {Object.keys(log.newValues || {}).map(field => {
                            if (field === 'updatedAt') return null;
                            const prev = log.previousValues?.[field];
                            const curr = log.newValues?.[field];
                            if (JSON.stringify(prev) === JSON.stringify(curr)) return null;

                            return (
                              <div key={field} className="grid grid-cols-6 gap-2 text-[10px]">
                                <span className="font-bold uppercase text-slate-400 col-span-1 shrink-0">{field}:</span>
                                <span className="col-span-5">
                                  Cambió de <span className="line-through text-red-500">{String(prev || 'vacio')}</span> a <strong className="text-slate-850">{String(curr)}</strong>
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
