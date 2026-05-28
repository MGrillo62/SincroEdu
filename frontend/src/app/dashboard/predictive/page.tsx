'use client';

import { getApiUrl } from '@/lib/config';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  CalendarDays, 
  Sparkles, 
  Activity, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  Plus, 
  Trash2, 
  Play, 
  Settings2, 
  RotateCw, 
  ChevronRight, 
  Sliders, 
  Layout, 
  Grid,
  Info,
  Layers,
  Percent,
  Check,
  X
} from 'lucide-react';

interface Classroom {
  id: string;
  tenantId: string;
  campusId?: string;
  name: string;
  type: 'classroom' | 'laboratory' | 'auditorium' | 'virtual_room';
  capacity: number;
  status: 'active' | 'maintenance' | 'inactive';
}

interface TimeSlot {
  id: string;
  tenantId: string;
  name: string;
  dayOfWeek: number; // 1-7
  startTime: string; // "HH:MM:SS"
  endTime: string; // "HH:MM:SS"
  type: 'standard' | 'lab' | 'recess' | 'special';
}

interface Professor {
  id: string;
  tenantId: string;
  userId: string;
  specialty: string;
  hireDate: string;
  hourlyRate: number;
  status: 'active' | 'license' | 'inactive';
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface Schedule {
  id: string;
  tenantId: string;
  courseId: string;
  professorId?: string;
  classroomId?: string;
  timeSlotId: string;
  academicPeriod: string;
  sectionCode: string;
  status: 'draft' | 'published';
  courseName?: string;
  courseCode?: string;
  courseCredits?: number;
  classroomName?: string;
  classroomCapacity?: number;
  classroomType?: string;
  timeSlotName?: string;
  timeSlotDay?: number;
  timeSlotStart?: string;
  timeSlotEnd?: string;
  professorName?: string;
  professorSpecialty?: string;
}

interface Course {
  id: string;
  code: string;
  name: string;
  description: string;
  credits: number;
  status: 'draft' | 'active' | 'archived';
}

interface Projection {
  courseId: string;
  courseCode: string;
  courseName: string;
  courseCredits: number;
  historicalEnrollment: number;
  projectedEnrollment: number;
  classroomCapacityLimit: number;
  suggestedSections: number;
  financials: {
    expectedRevenue: number;
    expectedCost: number;
    netProfit: number;
    marginPercentage: number;
  };
}

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' }
];

export default function PredictiveSchedulingPage() {
  const { tenant, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'grid' | 'predictive'>('grid');
  
  // Data lists from backend
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  // Predictive State
  const [growthRate, setGrowthRate] = useState<number>(0.15);
  const [targetPeriod, setTargetPeriod] = useState<string>('2026-II');
  const [projections, setProjections] = useState<Projection[]>([]);
  const [predictiveLoading, setPredictiveLoading] = useState<boolean>(false);
  
  // Loading states
  const [loading, setLoading] = useState<boolean>(false);
  const [cspLoading, setCspLoading] = useState<boolean>(false);
  
  // Selected Section for Scheduler
  const [selectedSection, setSelectedSection] = useState<string>('A');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-I');
  
  // Dialog / Edit form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  
  // Hover & collision warnings
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  
  // Global Notification / Toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Simulation Mode state (What-if scenario)
  const [simulationMode, setSimulationMode] = useState<boolean>(true);

  // Show a notification banner
  const triggerNotification = (message: string, type: 'success' | 'error' | 'warning') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // Fetch all basic scheduling records
  const fetchAllData = async () => {
    const activeTenantId = tenant?.id || '44b7fa71-5582-45a8-b6cb-918991ef2364';
    if (!token) return;
    setLoading(true);
    try {
      // 1. Classrooms
      const resClassrooms = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/scheduling/classrooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataClassrooms = await resClassrooms.json();
      if (resClassrooms.ok) setClassrooms(dataClassrooms);

      // 2. Time Slots
      const resSlots = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/scheduling/time-slots`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataSlots = await resSlots.json();
      if (resSlots.ok) setTimeSlots(dataSlots);

      // 3. Professors
      const resProfs = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/professors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataProfs = await resProfs.json();
      if (resProfs.ok) setProfessors(dataProfs);

      // 4. Active Courses
      const resCourses = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataCourses = await resCourses.json();
      if (resCourses.ok) setCoursesList(dataCourses.filter((c: any) => c.status === 'active'));

      // 5. Existing schedules
      const resScheds = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/scheduling/schedules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataScheds = await resScheds.json();
      if (resScheds.ok) setSchedules(dataScheds);

    } catch (err) {
      console.error('Error fetching baseline data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch demand projections
  const fetchProjections = async () => {
    const activeTenantId = tenant?.id || '44b7fa71-5582-45a8-b6cb-918991ef2364';
    if (!token) return;
    setPredictiveLoading(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/tenants/${activeTenantId}/scheduling/predictive-demand?growthRate=${growthRate}&targetPeriod=${targetPeriod}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await res.json();
      if (res.ok) {
        setProjections(data.projections || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPredictiveLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token, tenant]);

  useEffect(() => {
    if (token && activeTab === 'predictive') {
      fetchProjections();
    }
  }, [token, activeTab, growthRate, targetPeriod]);

  // Handle slot validation in real-time
  const runLiveValidation = async (
    courseId: string,
    profId: string,
    roomId: string,
    slotId: string
  ) => {
    if (!courseId || !slotId) return;
    const activeTenantId = tenant?.id || '44b7fa71-5582-45a8-b6cb-918991ef2364';
    setIsValidating(true);
    setValidationWarnings([]);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/scheduling/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId,
          professorId: profId || null,
          classroomId: roomId || null,
          timeSlotId: slotId,
          academicPeriod: selectedPeriod,
          sectionCode: selectedSection
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.hasConflict) {
          setValidationWarnings(data.conflicts);
        } else {
          setValidationWarnings([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  // Run live validation whenever form parameters change
  useEffect(() => {
    if (isFormOpen && selectedSlotId) {
      runLiveValidation(selectedCourseId, selectedProfessorId, selectedClassroomId, selectedSlotId);
    }
  }, [selectedCourseId, selectedProfessorId, selectedClassroomId, isFormOpen, selectedSlotId]);

  // Open Scheduler cell click dialog
  const handleCellClick = (timeSlotId: string, dayId: number) => {
    const existing = schedules.find(s => 
      s.timeSlotId === timeSlotId && 
      (s.timeSlotDay === dayId || timeSlots.find(ts => ts.id === timeSlotId)?.dayOfWeek === dayId) && 
      s.sectionCode === selectedSection && 
      s.academicPeriod === selectedPeriod
    );

    setSelectedSlotId(timeSlotId);
    setSelectedDayId(dayId);

    if (existing) {
      setSelectedCourseId(existing.courseId);
      setSelectedProfessorId(existing.professorId || '');
      setSelectedClassroomId(existing.classroomId || '');
    } else {
      setSelectedCourseId('');
      setSelectedProfessorId('');
      setSelectedClassroomId('');
    }
    setValidationWarnings([]);
    setIsFormOpen(true);
  };

  // Submit manual assignment
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) return;

    const activeTenantId = tenant?.id || '44b7fa71-5582-45a8-b6cb-918991ef2364';
    const existing = schedules.find(s => 
      s.timeSlotId === selectedSlotId && 
      s.sectionCode === selectedSection && 
      s.academicPeriod === selectedPeriod
    );

    // If both empty, do nothing
    if (!selectedCourseId) {
      if (existing) {
        // Delete
        handleDeleteAssignment(existing.id);
      }
      setIsFormOpen(false);
      return;
    }

    const payload = {
      courseId: selectedCourseId,
      professorId: selectedProfessorId || null,
      classroomId: selectedClassroomId || null,
      timeSlotId: selectedSlotId,
      academicPeriod: selectedPeriod,
      sectionCode: selectedSection,
      status: simulationMode ? 'draft' : 'published'
    };

    try {
      const url = existing 
        ? `${getApiUrl()}/tenants/${activeTenantId}/scheduling/schedules/${existing.id}`
        : `${getApiUrl()}/tenants/${activeTenantId}/scheduling/schedules`;
      
      const method = existing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        triggerNotification(
          `Sesión programada con éxito en modo ${simulationMode ? 'Simulación (Borrador)' : 'Oficial (Publicado)'}`,
          'success'
        );
        setIsFormOpen(false);
        fetchAllData();
      } else {
        triggerNotification(data.error || 'Error al guardar la asignación', 'error');
      }
    } catch (err: any) {
      console.error(err);
      triggerNotification('Error de red al conectar al motor de asignación', 'error');
    }
  };

  // Delete an assignment
  const handleDeleteAssignment = async (id: string) => {
    const activeTenantId = tenant?.id || '44b7fa71-5582-45a8-b6cb-918991ef2364';
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/scheduling/schedules/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        triggerNotification('Asignación eliminada con éxito.', 'success');
        setIsFormOpen(false);
        fetchAllData();
      } else {
        triggerNotification('No se pudo eliminar la asignación.', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Call the CSP Backtracking Solver
  const handleAutoSchedule = async () => {
    const activeTenantId = tenant?.id || '44b7fa71-5582-45a8-b6cb-918991ef2364';
    setCspLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/scheduling/auto-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          academicPeriod: selectedPeriod,
          sectionCode: selectedSection
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerNotification(data.message, 'success');
        fetchAllData();
      } else {
        triggerNotification(data.error || 'No se pudo resolver el algoritmo CSP', 'warning');
      }
    } catch (err) {
      console.error(err);
      triggerNotification('Error al invocar el motor de optimización CSP.', 'error');
    } finally {
      setCspLoading(false);
    }
  };

  // Publish all simulation drafts
  const handlePublishSchedules = async () => {
    const activeTenantId = tenant?.id || '44b7fa71-5582-45a8-b6cb-918991ef2364';
    const drafts = schedules.filter(s => s.status === 'draft');
    if (drafts.length === 0) {
      triggerNotification('No hay borradores de simulación pendientes por publicar.', 'warning');
      return;
    }

    try {
      let publishedCount = 0;
      for (const d of drafts) {
        const res = await fetch(`${getApiUrl()}/tenants/${activeTenantId}/scheduling/schedules/${d.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'published' })
        });
        if (res.ok) publishedCount++;
      }
      triggerNotification(`¡Excelente! Se publicaron ${publishedCount} asignaciones horarias oficialmente.`, 'success');
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to render grid assignments
  const getAssignmentAt = (timeSlotId: string, dayId: number) => {
    return schedules.find(s => 
      s.timeSlotId === timeSlotId && 
      (s.timeSlotDay === dayId || timeSlots.find(ts => ts.id === timeSlotId)?.dayOfWeek === dayId) && 
      s.sectionCode === selectedSection && 
      s.academicPeriod === selectedPeriod
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Alerts Banner */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[9999] p-4 rounded-2xl shadow-xl border flex items-start gap-3 w-96 animate-slide-in backdrop-blur-md ${
          notification.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' :
          notification.type === 'warning' ? 'bg-amber-500/90 text-white border-amber-400' :
          'bg-rose-500/90 text-white border-rose-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <div className="text-xs">
            <h4 className="font-bold">{notification.type === 'success' ? 'Éxito' : 'Advertencia'}</h4>
            <p className="opacity-90">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="ml-auto text-white hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Premium Dashboard Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-gradient-to-r from-[#1C2C35] to-[#2E4856] p-8 rounded-3xl shadow-xl relative overflow-hidden border border-slate-700/50">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#6B8E4E]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-[#6B8E4E]/20 border border-[#6B8E4E]/30 flex items-center justify-center text-[#6B8E4E] shadow-inner animate-pulse">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Programación Predictiva e Inteligencia de Horarios
              <span className="bg-[#6B8E4E]/20 text-[#8cb66c] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#6B8E4E]/30">EdTech CSP</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl mt-1">
              Optimización de horarios mediante Algoritmo CSP transaccional (Hard/Soft Constraints) y previsión de aforo dinámico de secciones según el límite físico del aula.
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 w-full xl:w-auto">
          {/* Simulation Toggle */}
          <div className="flex items-center gap-2.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
            <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
              simulationMode 
                ? 'bg-amber-500 text-slate-900 shadow-md font-bold' 
                : 'text-slate-400 font-semibold'
            }`}>
              Simulador Borrador
            </span>
            <button 
              onClick={() => {
                setSimulationMode(!simulationMode);
                triggerNotification(
                  `Cambiado a Modo ${!simulationMode ? 'Simulación de Borrador' : 'Oficial Directo'}`, 
                  'success'
                );
              }}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-slate-700"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  !simulationMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
              !simulationMode 
                ? 'bg-[#6B8E4E] text-white shadow-md font-bold' 
                : 'text-slate-400 font-semibold'
            }`}>
              Oficial Publicado
            </span>
          </div>

          {simulationMode && (
            <button 
              onClick={handlePublishSchedules}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md hover:scale-[1.01] transition-all cursor-pointer border border-amber-400/30"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Publicar Cambios
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('grid')}
          className={`pb-4 px-6 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'grid' 
              ? 'border-[#6B8E4E] text-[#6B8E4E]' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Grid className="w-4 h-4" />
          Planificador de Grilla & CSP
        </button>
        <button
          onClick={() => setActiveTab('predictive')}
          className={`pb-4 px-6 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'predictive' 
              ? 'border-[#6B8E4E] text-[#6B8E4E]' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Modelo Predictivo & ROI
        </button>
      </div>

      {activeTab === 'grid' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar controls for Section Selection */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Filter Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Settings2 className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-700">Filtros Académicos</h3>
              </div>

              {/* Period selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ciclo Lectivo</label>
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] cursor-pointer"
                >
                  <option value="2026-I">Ciclo Académico 2026-I</option>
                  <option value="2026-II">Ciclo Académico 2026-II (Próx.)</option>
                </select>
              </div>

              {/* Section selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sección Estudiante</label>
                <select 
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] cursor-pointer"
                >
                  <option value="A">Sección Académica A</option>
                  <option value="B">Sección Académica B</option>
                  <option value="C">Sección Académica C</option>
                </select>
              </div>

              {/* Reset view */}
              <button 
                onClick={fetchAllData}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Sincronizar Recursos
              </button>
            </div>

            {/* Smart Optimization Engine (CSP trigger) */}
            <div className="bg-gradient-to-br from-[#6B8E4E] to-[#58783E] text-white p-6 rounded-3xl shadow-md space-y-4 border border-[#6B8E4E]/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Motor CSP Predictivo</h3>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                El solver de Inteligencia Artificial creará la grilla horaria automáticamente sin colisiones físicas o de docentes para esta sección.
              </p>

              <div className="bg-black/10 p-3 rounded-2xl border border-white/10 space-y-2 text-[10px] opacity-90">
                <div className="flex items-center gap-1.5 text-amber-200 font-bold">
                  <Info className="w-3.5 h-3.5 text-[#6B8E4E] shrink-0" />
                  Estrategia de Optimización:
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Límite Físico:</strong> Respeto absoluto del aforo del aula física.</li>
                  <li><strong>Especialidad Académica:</strong> Priorización inteligente de docentes según afinidad histórica de especialidad.</li>
                </ul>
              </div>

              <button 
                onClick={handleAutoSchedule}
                disabled={cspLoading}
                className="w-full py-3 bg-white hover:bg-slate-100 text-[#58783E] font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                {cspLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Optimizando Horarios CSP...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Auto-Programación CSP
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Timetable Weekly Grid */}
          <div className="lg:col-span-3">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
              
              {loading ? (
                <div className="py-24 text-center text-xs text-slate-400">
                  <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#6B8E4E] mb-2" />
                  Sincronizando grilla de asignación...
                </div>
              ) : (
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left border-b border-slate-150 w-24">Bloque</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.id} className="p-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider text-center border-b border-slate-150">
                          {day.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-xs text-slate-400">
                          No hay bloques horarios configurados. Carga la semilla SQL inicial.
                        </td>
                      </tr>
                    ) : (
                      timeSlots.map(slot => (
                        <tr key={slot.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          {/* Time Column */}
                          <td className="p-3 font-semibold text-slate-700 text-xs border-r border-slate-100">
                            <div className="text-[11px] font-bold">{slot.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">{slot.startTime.substring(0,5)} - {slot.endTime.substring(0,5)}</div>
                          </td>

                          {/* Day Columns */}
                          {DAYS_OF_WEEK.map(day => {
                            const sched = getAssignmentAt(slot.id, day.id);

                            return (
                              <td 
                                key={day.id} 
                                onClick={() => handleCellClick(slot.id, day.id)}
                                className="p-2 border-r border-slate-100 w-1/5 min-w-[120px] transition-all relative cursor-pointer"
                              >
                                {sched ? (
                                  <div className={`p-3.5 rounded-2xl border text-left space-y-1.5 shadow-sm hover:scale-[1.01] transition-all group ${
                                    sched.status === 'draft'
                                      ? 'bg-amber-500/10 border-amber-300 text-amber-900'
                                      : 'bg-[#6B8E4E]/10 border-[#6B8E4E]/30 text-slate-850'
                                  }`}>
                                    <div className="flex justify-between items-start gap-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider bg-white/60 px-1.5 py-0.5 rounded border border-black/5 block truncate">
                                        {sched.courseCode}
                                      </span>
                                      
                                      {sched.status === 'draft' && (
                                        <span className="text-[8px] bg-amber-500 text-slate-950 font-bold px-1 py-0.2 rounded uppercase">
                                          Borrador
                                        </span>
                                      )}
                                    </div>
                                    
                                    <h4 className="text-xs font-bold leading-tight line-clamp-1">
                                      {sched.courseName}
                                    </h4>

                                    <div className="space-y-0.5 pt-1 text-[9px] opacity-80 border-t border-black/5">
                                      <div className="font-semibold truncate">👨‍🏫 {sched.professorName}</div>
                                      <div className="truncate">🏫 {sched.classroomName} <span className="opacity-60">({sched.classroomCapacity} cap)</span></div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-16 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-[#6B8E4E] hover:text-[#6B8E4E] hover:bg-[#6B8E4E]/5 transition-all text-[10px] font-semibold">
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Programar
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'predictive' && (
        <div className="space-y-6">
          
          {/* Simulation variables slider panel */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#6B8E4E]" />
                  Tasa de Crecimiento de Matrícula Proyectada
                </label>
                <span className="text-sm font-black text-[#6B8E4E] bg-[#6B8E4E]/10 px-3 py-0.5 rounded-full">
                  +{Math.round(growthRate * 100)}%
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="0.5" 
                step="0.05"
                value={growthRate}
                onChange={(e) => setGrowthRate(Number(e.target.value))}
                className="w-full accent-[#6B8E4E] cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
              />
              <p className="text-[10px] text-slate-400">
                Ajusta el crecimiento escolar estimado para simular la demanda de grupos en el próximo periodo.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ciclo Académico Objetivo</label>
              <select 
                value={targetPeriod}
                onChange={(e) => setTargetPeriod(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] cursor-pointer"
              >
                <option value="2026-II">Segundo Semestre 2026-II</option>
                <option value="2027-I">Primer Semestre 2027-I</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Acción Inteligente</label>
              <button 
                onClick={fetchProjections}
                disabled={predictiveLoading}
                className="w-full py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.01] transition-all"
              >
                {predictiveLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Re-simular Demanda
              </button>
            </div>

          </div>

          {/* Projections Table with margins */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Pronóstico de Secciones y ROI por Curso</h3>
                <p className="text-[10px] text-slate-400">Predicción calculada cruzando matriculados con el aforo físico del aula de clase.</p>
              </div>
              <div className="flex items-center gap-2 bg-[#6B8E4E]/10 px-3 py-1 rounded-xl text-[#6B8E4E] text-[10px] font-bold border border-[#6B8E4E]/20">
                <Percent className="w-3.5 h-3.5" />
                Precio de Crédito Proyectado: PEN {100.00}
              </div>
            </div>

            {predictiveLoading ? (
              <div className="py-24 text-center text-xs text-slate-400">
                <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#6B8E4E] mb-2" />
                Ejecutando algoritmo de proyección y rentabilidad...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150">
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Curso</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Matrícula Histórica</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Proyección Futura</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Límite Físico Aula</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Secciones Sugeridas</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ingresos Proyectados</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Gastos de Nómina</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Margen (ROI)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-xs text-slate-400">
                          Sin datos de proyección. Intenta simular.
                        </td>
                      </tr>
                    ) : (
                      projections.map(proj => (
                        <tr key={proj.courseId} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 text-left">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-xs">{proj.courseName}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{proj.courseCode} • {proj.courseCredits} créditos</span>
                            </div>
                          </td>
                          <td className="p-3 text-center text-xs font-bold text-slate-500">
                            {proj.historicalEnrollment} alum.
                          </td>
                          <td className="p-3 text-center text-xs font-bold text-blue-600 bg-blue-50/30">
                            {proj.projectedEnrollment} alum.
                          </td>
                          <td className="p-3 text-center text-xs font-bold text-slate-600">
                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {proj.classroomCapacityLimit} cap.
                            </span>
                          </td>
                          <td className="p-3 text-center text-xs font-black text-slate-800">
                            <span className="bg-[#6B8E4E]/10 text-[#58783E] px-2.5 py-0.5 rounded-full font-black border border-[#6B8E4E]/20">
                              {proj.suggestedSections} secc.
                            </span>
                          </td>
                          <td className="p-3 text-right text-xs font-bold text-slate-700">
                            S/ {proj.financials.expectedRevenue.toLocaleString()}
                          </td>
                          <td className="p-3 text-right text-xs font-bold text-rose-500">
                            S/ {proj.financials.expectedCost.toLocaleString()}
                          </td>
                          <td className="p-3 text-right text-xs">
                            <div className="flex flex-col items-end">
                              <span className={`font-black text-xs ${proj.financials.netProfit >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                                S/ {proj.financials.netProfit.toLocaleString()}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                proj.financials.marginPercentage >= 40 
                                  ? 'bg-green-50 text-green-700 border-green-200' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {proj.financials.marginPercentage}% margen
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Quick graphical indicators using CSS bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Total revenue simulation */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Ingresos vs Gastos Proyectados
              </h4>
              
              {projections.length > 0 && (
                <div className="space-y-3 pt-2">
                  {/* Revenue Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>Ingresos Totales (Inscripciones)</span>
                      <span>S/ {projections.reduce((a, b) => a + b.financials.expectedRevenue, 0).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-150 h-3 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '105%' }} />
                    </div>
                  </div>

                  {/* Cost Bar */}
                  <div className="space-y-1">
                    {(() => {
                      const totalRev = projections.reduce((a, b) => a + b.financials.expectedRevenue, 0);
                      const totalCost = projections.reduce((a, b) => a + b.financials.expectedCost, 0);
                      const costPct = totalRev > 0 ? Math.round((totalCost / totalRev) * 100) : 0;
                      
                      return (
                        <>
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>Costos Operativos (Facultad)</span>
                            <span>S/ {totalCost.toLocaleString()} ({costPct}%)</span>
                          </div>
                          <div className="w-full bg-slate-150 h-3 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(costPct, 100)}%` }} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Section Expansion */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                Secciones Requeridas vs Salones Activos
              </h4>

              {projections.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Total Secciones a Abrir:</span>
                    <span className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                      {projections.reduce((a, b) => a + b.suggestedSections, 0)} Grupos
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Salones Físicos Disponibles:</span>
                    <span className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                      {classrooms.filter(c => c.type === 'classroom').length} Aulas
                    </span>
                  </div>

                  <div className="pt-1 text-[9px] text-slate-400 leading-normal flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 text-[#6B8E4E] shrink-0" />
                    El aforo físico alineado evita alquileres innecesarios o sobredemanda de espacios físicos del campus.
                  </div>
                </div>
              )}
            </div>

            {/* Operational Profitability card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-500" />
                ROI y Rendimiento Operativo
              </h4>

              {projections.length > 0 && (
                <div className="space-y-3 pt-2">
                  {(() => {
                    const totalRev = projections.reduce((a, b) => a + b.financials.expectedRevenue, 0);
                    const totalCost = projections.reduce((a, b) => a + b.financials.expectedCost, 0);
                    const totalProfit = totalRev - totalCost;
                    const margin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0;

                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400 font-semibold">Beneficio Neto:</span>
                          <span className="text-base font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">
                            S/ {totalProfit.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400 font-semibold">Margen de Rentabilidad:</span>
                          <span className="text-sm font-black text-purple-600 bg-purple-50 px-3 py-1 rounded-xl">
                            {margin}% Margen
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Manual assignment dialog */}
      {isFormOpen && selectedSlotId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1C2C35] flex items-center gap-2">
                  Asignación y Planificación Horaria
                  {simulationMode && (
                    <span className="bg-amber-100 text-amber-800 border border-amber-250 text-[9px] font-bold px-2 py-0.5 rounded">
                      Simulador
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Modifica los recursos para la Sección "{selectedSection}" en el bloque seleccionado.
                </p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-[#1C2C35] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4">
              
              {/* Course Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">Asignatura Académica</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">-- Quitar curso / Liberar bloque --</option>
                  {coursesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code} - {c.credits} cr)</option>
                  ))}
                </select>
              </div>

              {selectedCourseId && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Professor selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">Docente Asignado</label>
                    <select
                      value={selectedProfessorId}
                      onChange={(e) => setSelectedProfessorId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">-- Sin asignar --</option>
                      {professors.map(p => (
                        <option key={p.id} value={p.id}>{p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Sin nombre'}</option>
                      ))}
                    </select>
                  </div>

                  {/* Classroom selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider block">Aula Física / Virtual</label>
                    <select
                      value={selectedClassroomId}
                      onChange={(e) => setSelectedClassroomId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">-- Sin asignar --</option>
                      {classrooms.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (Aforo: {c.capacity})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Dynamic live validation warnings */}
              {selectedCourseId && (
                <div className="pt-2">
                  <div className="text-[10px] font-bold text-[#1C2C35]/80 uppercase tracking-wider mb-1.5 block">
                    Validación Transaccional CSP
                  </div>
                  
                  {isValidating ? (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 animate-spin text-[#6B8E4E]" />
                      Validando colisiones de recursos...
                    </div>
                  ) : validationWarnings.length > 0 ? (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl space-y-1">
                      <div className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        Conflicto Crítico Detectado (Restricción CSP Violada):
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-[9px] text-rose-600 font-medium">
                        {validationWarnings.map((warn, i) => <li key={i}>{warn}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2 text-[10px] text-emerald-800 font-semibold">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ¡Bloque libre y apto! Ningún conflicto de aforo, aula, docente o sección.
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                {/* Delete button if exists */}
                {schedules.some(s => s.timeSlotId === selectedSlotId && s.sectionCode === selectedSection && s.academicPeriod === selectedPeriod) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const existing = schedules.find(s => s.timeSlotId === selectedSlotId && s.sectionCode === selectedSection && s.academicPeriod === selectedPeriod);
                      if (existing) handleDeleteAssignment(existing.id);
                    }}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all border border-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    Quitar Asignación
                  </button>
                ) : <div />}

                <div className="flex gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-150 text-[#1C2C35]/60 rounded-xl transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={validationWarnings.length > 0 && selectedCourseId !== ''}
                    className="px-4 py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white rounded-xl shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Confirmar
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
