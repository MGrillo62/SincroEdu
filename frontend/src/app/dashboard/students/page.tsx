'use client';

import { getApiUrl } from '@/lib/config';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import DataTable, { Column } from '@/components/ui/data-table';
import SelectSearch from '@/components/ui/select-search';
import { 
  FileText, 
  Plus, 
  History, 
  Edit3, 
  BookOpen, 
  X,
  UserCheck,
  GraduationCap,
  Calendar,
  AlertTriangle,
  MinusCircle,
  HelpCircle,
  PlusCircle,
  Info
} from 'lucide-react';

interface Student {
  id: string;
  enrollmentNumber: string;
  documentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string;
  admissionDate: string;
  status: 'active' | 'suspended' | 'graduated' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  academicPeriod: string;
  status: 'active' | 'dropped' | 'completed';
  courseCode: string;
  courseName: string;
  courseCredits: number;
  createdAt: string;
  updatedAt: string;
}

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  status: string;
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

export default function StudentsPage() {
  const { tenant, token } = useAuthStore();
  
  // Estados de datos
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [enrollmentsList, setEnrollmentsList] = useState<Enrollment[]>([]);
  const [historyList, setHistoryList] = useState<AuditLog[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

  // Estados de modales y cajones
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEnrollmentsOpen, setIsEnrollmentsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Estados para validación de prerrequisitos académicos
  const [missingPrereqs, setMissingPrereqs] = useState<{ id: string; code: string; name: string }[]>([]);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  
  // Campos del formulario de Estudiante
  const [docId, setDocId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');
  const [studentStatus, setStudentStatus] = useState<'active' | 'suspended' | 'graduated' | 'inactive'>('active');
  const [editMode, setEditMode] = useState(false);

  // Campos del formulario de Matrícula
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [academicPeriod, setAcademicPeriod] = useState('2026-I');

  // Formateador de Fechas DD/MM/AAAA
  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    // Si ya viene formateada en dd/mm/aaaa, retornarla tal cual
    if (isoString.includes('/') && isoString.length === 10) return isoString;
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString; // Fallback
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Cargar estudiantes del Backend
  const fetchStudents = async () => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStudentsList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar catálogo de cursos activos (para la matrícula)
  const fetchCourses = async () => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Mostrar sólo cursos activos en la matrícula
        setCoursesList(data.filter((c: Course) => c.status === 'active'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStudents();
      fetchCourses();
    }
  }, [token, tenant]);

  // Capturar pre-carga express desde CRM
  useEffect(() => {
    if (token && typeof window !== 'undefined') {
      const preload = sessionStorage.getItem('sincroedu_lead_enroll_preload');
      if (preload) {
        try {
          const data = JSON.parse(preload);
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
          setDocId(`L-${Math.floor(10000000 + Math.random() * 90000000)}`);
          
          setEditMode(false);
          setIsFormOpen(true);
          sessionStorage.removeItem('sincroedu_lead_enroll_preload');
        } catch (err) {
          console.error('Error preloading lead data:', err);
        }
      }
    }
  }, [token]);

  // Limpiar errores de matrícula al cambiar de curso
  useEffect(() => {
    setMissingPrereqs([]);
    setEnrollmentError(null);
  }, [selectedCourseId]);

  // Cargar matrículas de un alumno
  const fetchEnrollments = async (student: Student) => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    setEnrollmentsLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/students/${student.id}/enrollments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollmentsList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  // Cargar historial de auditoría de un alumno
  const openHistory = async (student: Student) => {
    setSelectedStudent(student);
    setIsHistoryOpen(true);
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/students/${student.id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistoryList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Abrir cajón para matricular asignaturas
  const openEnrollmentsPanel = (student: Student) => {
    setSelectedStudent(student);
    setSelectedCourseId('');
    setAcademicPeriod('2026-I');
    setMissingPrereqs([]);
    setEnrollmentError(null);
    setIsEnrollmentsOpen(true);
    fetchEnrollments(student);
  };

  // Abrir formulario para crear alumno
  const openCreateForm = () => {
    setEditMode(false);
    setDocId('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setBirthDate('');
    
    // Autocompletar la fecha de hoy en formato dd/mm/aaaa
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setAdmissionDate(`${day}/${month}/${year}`);
    
    setStudentStatus('active');
    setIsFormOpen(true);
  };

  // Abrir formulario para editar alumno
  const openEditForm = (student: Student) => {
    setEditMode(true);
    setSelectedStudent(student);
    setDocId(student.documentId);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setEmail(student.email);
    setPhone(student.phone || '');
    setBirthDate(student.birthDate);
    setAdmissionDate(student.admissionDate);
    setStudentStatus(student.status);
    setIsFormOpen(true);
  };

  // Guardar Alumno (Crear / Editar)
  const handleSubmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;

    // Validación sencilla de fecha dd/mm/aaaa
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(birthDate) || !dateRegex.test(admissionDate)) {
      alert('Las fechas deben tener el formato exacto dd/mm/aaaa (Ej: 15/08/2005)');
      return;
    }

    const url = editMode 
      ? `${getApiUrl()}/tenants/${activeTenantId}/students/${selectedStudent?.id}`
      : `${getApiUrl()}/tenants/${activeTenantId}/students`;
    
    const method = editMode ? 'PUT' : 'POST';
    const body = editMode 
      ? { documentId: docId, firstName, lastName, email, phone: phone || null, birthDate, admissionDate }
      : { documentId: docId, firstName, lastName, email, phone: phone || null, birthDate, admissionDate, status: studentStatus };

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
        fetchStudents();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al guardar el expediente');
    }
  };

  // Cambiar Estado del estudiante directamente
  const handleStatusChange = async (student: Student, newStatus: 'active' | 'suspended' | 'graduated' | 'inactive') => {
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/students/${student.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchStudents();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Registrar nueva matrícula de asignatura
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !selectedStudent) return;
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;

    setMissingPrereqs([]);
    setEnrollmentError(null);

    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/students/${selectedStudent.id}/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ courseId: selectedCourseId, academicPeriod })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedCourseId('');
        setMissingPrereqs([]);
        setEnrollmentError(null);
        fetchEnrollments(selectedStudent);
      } else {
        if (data.missingPrerequisites) {
          setMissingPrereqs(data.missingPrerequisites);
          setEnrollmentError(data.error);
        } else {
          setEnrollmentError(data.error || 'Error desconocido al matricular');
        }
      }
    } catch (err) {
      console.error(err);
      setEnrollmentError('Error de conexión con el servidor');
    }
  };

  // Retirar o dar de baja una matrícula (dropped)
  const handleDropEnrollment = async (enrollmentId: string) => {
    if (!selectedStudent) return;
    const activeTenantId = tenant?.id || 't-11111111-1111-1111-1111-111111111111';
    if (!token) return;

    const confirmDrop = window.confirm('¿Está seguro de retirar este curso del estudiante? La acción registrará la baja en la bitácora de auditoría.');
    if (!confirmDrop) return;

    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/students/${selectedStudent.id}/enrollments/${enrollmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchEnrollments(selectedStudent);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mapear cursos para el componente SelectSearch autocomplete
  const courseOptions = coursesList.map(c => ({
    value: c.id,
    label: `${c.code} - ${c.name} (${c.credits} cr)`
  }));

  // Columnas para DataTable
  const columns: Column<Student>[] = [
    {
      accessor: 'enrollmentNumber',
      label: 'N° Matrícula',
      sortable: true,
      render: (row) => <span className="font-mono font-bold text-slate-800">{row.enrollmentNumber}</span>
    },
    {
      accessor: 'documentId',
      label: 'Documento / DNI',
      sortable: true,
      render: (row) => <span className="font-semibold text-slate-650">{row.documentId}</span>
    },
    {
      accessor: 'lastName',
      label: 'Estudiante (Apellidos y Nombres)',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#1C2C35]">{row.lastName}, {row.firstName}</span>
          <span className="text-[10px] text-slate-400 font-semibold">{row.email}</span>
        </div>
      )
    },
    {
      accessor: 'admissionDate',
      label: 'Fecha Admisión',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <Calendar className="w-3.5 h-3.5 text-[#6B8E4E]" />
          {row.admissionDate}
        </div>
      )
    },
    {
      accessor: 'phone',
      label: 'Contacto / Teléfono',
      sortable: false,
      render: (row) => <span className="text-slate-500 font-medium">{row.phone || 'Sin registrar'}</span>
    },
    {
      accessor: 'status',
      label: 'Estado',
      sortable: true,
      render: (row) => {
        const statusColors = {
          active: 'bg-green-100 text-green-800 border-green-200',
          suspended: 'bg-amber-100 text-amber-800 border-amber-200',
          graduated: 'bg-blue-100 text-blue-800 border-blue-200',
          inactive: 'bg-slate-100 text-slate-800 border-slate-200'
        };

        return (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusColors[row.status]}`}>
              {row.status === 'active' ? 'Activo' : row.status === 'suspended' ? 'Suspendido' : row.status === 'graduated' ? 'Graduado' : 'Inactivo'}
            </span>
            
            {/* Opciones rápidas de estado */}
            <div className="flex gap-0.5">
              {row.status !== 'active' && (
                <button 
                  onClick={() => handleStatusChange(row, 'active')}
                  title="Cambiar a Activo"
                  className="p-1 hover:bg-green-50 text-green-600 rounded transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'suspended' && (
                <button 
                  onClick={() => handleStatusChange(row, 'suspended')}
                  title="Cambiar a Suspendido"
                  className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
              )}
              {row.status !== 'graduated' && (
                <button 
                  onClick={() => handleStatusChange(row, 'graduated')}
                  title="Egresar Estudiante"
                  className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      }
    },
    {
      accessor: 'id',
      label: 'Acciones',
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditForm(row)}
            className="p-1.5 hover:bg-[#6B8E4E]/10 text-[#6B8E4E] rounded-xl transition-all"
            title="Editar Expediente"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEnrollmentsPanel(row)}
            className="p-1.5 hover:bg-[#1C2C35]/15 text-[#1C2C35] rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200"
            title="Matrícula y Cursos"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#6B8E4E]" />
            Cursos
          </button>
          <button
            onClick={() => openHistory(row)}
            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-xl transition-all"
            title="Bitácora de Auditoría"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  // Calcular métricas
  const totalStudents = studentsList.length;
  const activeStudents = studentsList.filter(s => s.status === 'active').length;
  const retentionRate = totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(1) : '100';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* HEADER DE LA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-[#6B8E4E]/10 rounded-2xl">
            <FileText className="w-7 h-7 text-[#6B8E4E]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C2C35]">Alumnos</h1>
            <p className="text-xs text-slate-400 font-semibold">Administra expedientes académicos, datos personales e inscripciones del periodo actual</p>
          </div>
        </div>
        
        <button
          onClick={openCreateForm}
          className="flex items-center justify-center gap-2 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-extrabold text-xs px-5 py-3.5 rounded-2xl shadow-lg shadow-[#6B8E4E]/20 transition-all hover:scale-[1.01]"
        >
          <Plus className="w-4 h-4" />
          Nuevo Estudiante
        </button>
      </div>

      {/* METRICAS PREMIUM CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.01)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Total Estudiantes</span>
            <h3 className="text-2xl font-black text-[#1C2C35]">{totalStudents}</h3>
          </div>
          <span className="p-2.5 bg-slate-100 text-slate-500 rounded-2xl font-extrabold text-xs">Registrados</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.01)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Alumnos Activos</span>
            <h3 className="text-2xl font-black text-[#6B8E4E]">{activeStudents}</h3>
          </div>
          <span className="p-2.5 bg-green-55/15 text-green-700 rounded-2xl font-extrabold text-xs">Vigentes</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.01)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Tasa de Retención</span>
            <h3 className="text-2xl font-black text-[#1C2C35]">{retentionRate}%</h3>
          </div>
          <span className="p-2.5 bg-[#6B8E4E]/10 text-[#6B8E4E] rounded-2xl font-extrabold text-xs">Óptimo</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.01)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Periodo Académico</span>
            <h3 className="text-2xl font-black text-slate-800">2026-I</h3>
          </div>
          <span className="p-2.5 bg-slate-100 text-slate-500 rounded-2xl font-extrabold text-xs">Vigente</span>
        </div>

      </div>

      {/* GRILLA DE DATOS DATATABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] overflow-hidden p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-4">
          <span className="w-2.5 h-6 bg-[#6B8E4E] rounded-full"></span>
          <h2 className="text-sm font-black text-[#1C2C35]">Listado General de Alumnos Matriculados</h2>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-semibold flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-4 border-[#6B8E4E] border-t-transparent rounded-full animate-spin"></div>
            Cargando expedientes de la institución...
          </div>
        ) : (
          <DataTable data={studentsList} columns={columns} searchPlaceholder="Buscar por nombre, apellido, código o DNI..." />
        )}
      </div>

      {/* ====================================================================== */}
      {/* CAJÓN LATERAL: REGISTRAR / EDITAR ESTUDIANTE */}
      {/* ====================================================================== */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex justify-end animate-fade-in">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 space-y-6 overflow-y-auto animate-slide-left border-l border-slate-100">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#6B8E4E]" />
                <h3 className="text-base font-black text-[#1C2C35]">
                  {editMode ? 'Editar Expediente de Alumno' : 'Registrar Nuevo Estudiante'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#1C2C35] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStudent} className="space-y-4 flex-1">
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Documento de Identidad / DNI *</label>
                <input
                  type="text"
                  required
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="Ej: DNI 72615438"
                  className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:border-[#6B8E4E] focus:bg-white focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Nombres *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ej: Alejandro"
                    className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:border-[#6B8E4E] focus:bg-white focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ej: Mendoza Torres"
                    className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:border-[#6B8E4E] focus:bg-white focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej: alejandro.mendoza@student.edu"
                  className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:border-[#6B8E4E] focus:bg-white focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Número de Teléfono</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: +51 987 111 222"
                  className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:border-[#6B8E4E] focus:bg-white focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Fecha Nacimiento *</label>
                  <input
                    type="text"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="dd/mm/aaaa"
                    className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:border-[#6B8E4E] focus:bg-white focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-semibold"
                  />
                  <span className="text-[9px] font-semibold text-slate-400">Usar formato estrictamente dd/mm/aaaa</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Fecha Admisión *</label>
                  <input
                    type="text"
                    required
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    placeholder="dd/mm/aaaa"
                    className="w-full pl-3.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:border-[#6B8E4E] focus:bg-white focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-semibold"
                  />
                  <span className="text-[9px] font-semibold text-slate-400">Usar formato estrictamente dd/mm/aaaa</span>
                </div>
              </div>

              {!editMode && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Estado Inicial del Estudiante</label>
                  <div className="flex gap-2">
                    {['active', 'suspended', 'graduated', 'inactive'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStudentStatus(st as any)}
                        className={`flex-1 py-2.5 rounded-xl border text-[10px] font-bold uppercase transition-all ${
                          studentStatus === st 
                            ? 'bg-[#6B8E4E] text-white border-[#6B8E4E] shadow-sm'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {st === 'active' ? 'Activo' : st === 'suspended' ? 'Suspendido' : st === 'graduated' ? 'Graduado' : 'Inactivo'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-3.5 border border-slate-200 text-[#1C2C35] hover:bg-slate-50 font-extrabold text-xs rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-[#6B8E4E] text-white font-extrabold text-xs rounded-2xl hover:bg-[#6B8E4E]/90 shadow-lg shadow-[#6B8E4E]/20 transition-all"
                >
                  {editMode ? 'Guardar Cambios' : 'Registrar Estudiante'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* CAJÓN LATERAL: GESTIÓN DE MATRÍCULAS Y CURSOS DEL PERIODO */}
      {/* ====================================================================== */}
      {isEnrollmentsOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex justify-end animate-fade-in">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 space-y-6 overflow-y-auto animate-slide-left border-l border-slate-100">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#6B8E4E]" />
                <div>
                  <h3 className="text-sm font-black text-[#1C2C35]">Plan de Estudios y Matrícula Activa</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedStudent.lastName}, {selectedStudent.firstName} ({selectedStudent.enrollmentNumber})</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEnrollmentsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#1C2C35] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORMULARIO DE MATRÍCULA RÁPIDA */}
            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150 space-y-3">
              <h4 className="text-xs font-black text-[#1C2C35] flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-[#6B8E4E]" />
                Inscribir en Nueva Asignatura (Periodo 2026-I)
              </h4>
              
              <form onSubmit={handleEnrollSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Buscar Asignatura Activa *</label>
                  <SelectSearch
                    options={courseOptions}
                    value={selectedCourseId}
                    onChange={(val) => setSelectedCourseId(val)}
                    placeholder="Escribe el código o nombre de la asignatura activa..."
                  />
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Periodo Académico</label>
                    <input
                      type="text"
                      disabled
                      value={academicPeriod}
                      className="w-full pl-3 pr-3 py-2 border border-slate-200 text-xs bg-slate-100 rounded-xl outline-none font-bold text-slate-550 cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!selectedCourseId}
                    className={`shrink-0 self-end font-extrabold text-xs px-5 py-2.5 rounded-xl text-white shadow transition-all ${
                      selectedCourseId 
                        ? 'bg-[#6B8E4E] hover:bg-[#6B8E4E]/90' 
                        : 'bg-slate-300 pointer-events-none'
                    }`}
                  >
                    Confirmar Inscripción
                  </button>
                </div>
              </form>
            </div>

            {/* ALERTA DE ERROR O PRERREQUISITOS FALTANTES */}
            {(enrollmentError || missingPrereqs.length > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5 animate-fade-in shrink-0">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-amber-900">{enrollmentError || 'Requisitos académicos no cumplidos'}</h5>
                    <p className="text-[10px] font-bold text-amber-700/80 leading-normal">
                      El estudiante no cumple con la malla curricular para poder inscribirse en este curso.
                    </p>
                  </div>
                </div>

                {missingPrereqs.length > 0 && (
                  <div className="pl-7 space-y-2 border-t border-amber-150 pt-2.5">
                    <span className="text-[9px] uppercase font-black text-amber-800 tracking-wider block">Cursos Obligatorios Pendientes:</span>
                    <ul className="space-y-1">
                      {missingPrereqs.map((prereq) => (
                        <li key={prereq.id} className="flex items-center gap-2 text-[10px] font-bold text-amber-900 bg-white/60 px-2.5 py-1.5 rounded-xl border border-amber-100/50 shadow-sm">
                          <span className="font-mono text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-extrabold">{prereq.code}</span>
                          <span>{prereq.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* LISTADO DE CURSOS MATRICULADOS */}
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex items-center gap-1.5 text-[#1C2C35]">
                <Info className="w-4.5 h-4.5 text-[#6B8E4E]" />
                <span className="text-xs font-black">Asignaturas Registradas</span>
              </div>

              {enrollmentsLoading ? (
                <div className="py-12 text-center text-xs text-slate-450 font-semibold flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#6B8E4E] border-t-transparent rounded-full animate-spin"></div>
                  Obteniendo asignaturas matriculadas...
                </div>
              ) : enrollmentsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-50">
                  <BookOpen className="w-8 h-8 text-slate-300" />
                  El estudiante no se encuentra matriculado en ningún curso del periodo actual
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                  {enrollmentsList.map((en) => {
                    const statusColors = {
                      active: 'bg-green-50 text-green-700 border-green-150',
                      dropped: 'bg-red-50 text-red-700 border-red-150',
                      completed: 'bg-blue-50 text-blue-700 border-blue-150'
                    };
                    return (
                      <div 
                        key={en.id} 
                        className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all hover:bg-slate-50/50 ${
                          en.status === 'dropped' ? 'bg-red-50/10 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'
                        }`}
                      >
                        <div className="space-y-1 max-w-[70%]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-405 bg-slate-100 px-1.5 py-0.5 rounded">{en.courseCode}</span>
                            <span className="text-xs font-extrabold text-[#1C2C35] truncate max-w-xs">{en.courseName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                            <span>Créditos: <strong className="text-slate-500 font-bold">{en.courseCredits} cr</strong></span>
                            <span>•</span>
                            <span>Periodo: <strong className="text-slate-500 font-bold">{en.academicPeriod}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded ${statusColors[en.status]}`}>
                            {en.status === 'active' ? 'Matriculado' : en.status === 'dropped' ? 'Retirado' : 'Aprobado'}
                          </span>
                          
                          {en.status === 'active' && (
                            <button
                              onClick={() => handleDropEnrollment(en.id)}
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-xl transition-all"
                              title="Retirar Asignatura"
                            >
                              <MinusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsEnrollmentsOpen(false)}
                className="w-full py-3.5 bg-[#1C2C35] hover:bg-[#1C2C35]/90 text-white font-extrabold text-xs rounded-2xl shadow transition-all"
              >
                Cerrar Panel de Matrícula
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* CAJÓN LATERAL: HISTORIAL DE AUDITORÍA CRONOLÓGICO */}
      {/* ====================================================================== */}
      {isHistoryOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex justify-end animate-fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-6 space-y-6 overflow-y-auto animate-slide-left border-l border-slate-100">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#6B8E4E]" />
                <div>
                  <h3 className="text-sm font-black text-[#1C2C35]">Bitácora de Cambios e Historial</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedStudent.lastName}, {selectedStudent.firstName} ({selectedStudent.enrollmentNumber})</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#1C2C35] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LISTA DE ENTRADAS DE HISTORIAL */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {historyList.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-50">
                  <History className="w-8 h-8 text-slate-350" />
                  No existen registros de auditoría para este estudiante
                </div>
              ) : (
                <div className="relative border-l-2 border-[#6B8E4E]/20 ml-2.5 pl-5 space-y-6">
                  {historyList.map((log) => {
                    const diffKeys = log.newValues ? Object.keys(log.newValues) : [];
                    const actionLabels = {
                      CREATE: { label: 'Creación de Expediente', color: 'bg-green-100 text-green-800 border-green-200' },
                      UPDATE: { label: 'Edición de Datos', color: 'bg-blue-100 text-blue-800 border-blue-200' },
                      STATUS_CHANGE: { label: 'Cambio de Estado', color: 'bg-amber-100 text-amber-800 border-amber-200' }
                    };
                    const badge = actionLabels[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-800' };

                    return (
                      <div key={log.id} className="relative space-y-2">
                        {/* Nodo en la línea de tiempo */}
                        <div className="absolute -left-[27px] top-1.5 w-3 h-3 bg-[#6B8E4E] border-2 border-white rounded-full ring-4 ring-[#6B8E4E]/15"></div>
                        
                        {/* Cabecera del Log */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 border text-[9px] font-extrabold uppercase rounded ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{formatDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Modificaciones */}
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 text-[11px] font-semibold text-slate-600 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-b border-slate-150 pb-1.5 mb-1.5">
                            <span>Modificado por: <strong className="text-slate-650 font-black">{log.changedBy}</strong></span>
                            <span>ID: {log.id}</span>
                          </div>

                          {log.action === 'CREATE' && (
                            <div className="text-slate-500 font-medium italic">Expediente registrado con éxito en el sistema.</div>
                          )}

                          {log.action === 'STATUS_CHANGE' && (
                            <div className="flex items-center gap-1.5">
                              <span>Estado alterado:</span>
                              <span className="line-through text-red-650 bg-red-50 px-1 py-0.5 rounded font-mono text-[10px]">
                                {log.previousValues?.status === 'active' ? 'ACTIVO' : log.previousValues?.status === 'suspended' ? 'SUSPENDIDO' : log.previousValues?.status === 'graduated' ? 'EGRESADO' : 'INACTIVO'}
                              </span>
                              <span className="text-slate-400 font-bold">&rarr;</span>
                              <span className="text-green-700 bg-green-50 px-1 py-0.5 rounded font-bold font-mono text-[10px]">
                                {log.newValues?.status === 'active' ? 'ACTIVO' : log.newValues?.status === 'suspended' ? 'SUSPENDIDO' : log.newValues?.status === 'graduated' ? 'EGRESADO' : 'INACTIVO'}
                              </span>
                            </div>
                          )}

                          {log.action === 'UPDATE' && diffKeys.length > 0 && (
                            <div className="space-y-1.5">
                              {diffKeys.map((key) => {
                                // Evitar mostrar campos internos o no alterados
                                if (['updatedAt', 'id', 'tenantId', 'enrollmentNumber'].includes(key)) return null;
                                
                                const prevVal = log.previousValues?.[key];
                                const newVal = log.newValues?.[key];
                                
                                // Traducir etiquetas de campos
                                const labels: Record<string, string> = {
                                  firstName: 'Nombres',
                                  lastName: 'Apellidos',
                                  email: 'Correo',
                                  phone: 'Teléfono',
                                  documentId: 'DNI / Documento',
                                  birthDate: 'Fecha Nacimiento',
                                  admissionDate: 'Fecha Admisión'
                                };
                                const label = labels[key] || key;

                                return (
                                  <div key={key} className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-[#1C2C35]">{label}:</span>
                                    <span className="line-through text-red-650 bg-red-50 px-1 py-0.5 rounded font-mono text-[10px]">
                                      {prevVal === null || prevVal === undefined || prevVal === '' ? '(vacío)' : String(prevVal)}
                                    </span>
                                    <span className="text-slate-450 font-bold">&rarr;</span>
                                    <span className="text-green-700 bg-green-50 px-1 py-0.5 rounded font-bold font-mono text-[10px]">
                                      {newVal === null || newVal === undefined || newVal === '' ? '(vacío)' : String(newVal)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="w-full py-3.5 bg-[#1C2C35] hover:bg-[#1C2C35]/90 text-white font-extrabold text-xs rounded-2xl shadow transition-all"
              >
                Cerrar Bitácora
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
