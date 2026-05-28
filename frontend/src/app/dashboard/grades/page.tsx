'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiUrl } from '@/lib/config';
import { 
  Award, 
  Settings, 
  History, 
  Lock, 
  Unlock, 
  Save, 
  FileText, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Printer, 
  Search, 
  Check, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Sliders,
  ChevronRight
} from 'lucide-react';

interface Student {
  id: string;
  enrollmentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface EvaluationStructure {
  id: string;
  name: string;
  weight: number;
}

interface GradeRecord {
  id: string;
  studentId: string;
  evaluationStructureId: string;
  value: number;
  letter?: string;
  comment?: string;
}

interface GradeScale {
  id: string;
  name: string;
  type: 'numeric-20' | 'numeric-100' | 'letter' | 'competency';
  minGrade: number;
  maxGrade: number;
  passingGrade: number;
}

interface AuditLog {
  id: string;
  studentName: string;
  evaluationName: string;
  previousValue: number | null;
  previousLetter: string | null;
  newValue: number;
  newLetter: string | null;
  changedBy: string;
  reason: string;
  createdAt: string;
}

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  status: string;
}

export default function GradesPage() {
  const { user, tenant, token } = useAuthStore();

  // Estados de Carga y Selectores
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('2026-I');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Datos del Curso Seleccionado
  const [students, setStudents] = useState<Student[]>([]);
  const [evalStructures, setEvalStructures] = useState<EvaluationStructure[]>([]);
  const [grades, setGrades] = useState<Record<string, Record<string, { value: string; letter: string; comment: string }>>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [gradeScale, setGradeScale] = useState<GradeScale | null>(null);

  // Auditoría e Historial
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [auditReason, setAuditReason] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Configuración de Pesos y Estructuras (Panel Flotante)
  const [showWeightsModal, setShowWeightsModal] = useState(false);
  const [tempWeights, setTempWeights] = useState<EvaluationStructure[]>([]);
  const [savingWeights, setSavingWeights] = useState(false);

  // Libreta de Calificaciones / Boletín PDF
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [reportCardData, setReportCardData] = useState<any | null>(null);
  const [loadingReportCard, setLoadingReportCard] = useState(false);

  // Buscador local de alumnos en la lista
  const [searchQuery, setSearchQuery] = useState('');

  // Referencias para la navegación con flechas (Spreadsheet UX)
  const gridInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Cargar lista de cursos de la institución
  const fetchCourses = async () => {
    if (!token || !tenant) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const activeCourses = data.filter((c: any) => c.status === 'active');
        setCoursesList(activeCourses);
        if (activeCourses.length > 0) {
          setSelectedCourseId(activeCourses[0].id);
        }
      }
    } catch (err) {
      console.error('Error al cargar cursos:', err);
    }
  };

  // Cargar calificaciones y estructura de un curso seleccionado
  const fetchGradesData = async (courseId: string) => {
    if (!token || !tenant || !courseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/courses/${courseId}/grades?academicPeriod=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students);
        setEvalStructures(data.evaluationStructures);
        setIsLocked(data.isLocked);
        setGradeScale(data.scale);

        // Mapear notas a matriz de estado { [studentId]: { [evalStructureId]: { value, letter, comment } } }
        const initialGrades: Record<string, Record<string, { value: string; letter: string; comment: string }>> = {};
        
        data.students.forEach((stu: Student) => {
          initialGrades[stu.id] = {};
          data.evaluationStructures.forEach((evalStr: EvaluationStructure) => {
            // Buscar si ya tiene nota registrada
            const rec = data.grades.find((g: any) => g.studentId === stu.id && g.evaluationStructureId === evalStr.id);
            initialGrades[stu.id][evalStr.id] = {
              value: rec ? String(rec.value) : '',
              letter: rec && rec.letter ? rec.letter : '',
              comment: rec && rec.comment ? rec.comment : ''
            };
          });
        });
        setGrades(initialGrades);
      }
    } catch (err) {
      console.error('Error al cargar calificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [token, tenant]);

  useEffect(() => {
    if (selectedCourseId) {
      fetchGradesData(selectedCourseId);
    }
  }, [selectedCourseId, selectedPeriod]);

  // Cargar Bitácora de Auditoría
  const fetchAuditLogs = async () => {
    if (!token || !tenant || !selectedCourseId) return;
    setLoadingAudit(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/courses/${selectedCourseId}/grades/audit?academicPeriod=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAuditLogsList(data);
      }
    } catch (err) {
      console.error('Error al cargar auditoría:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Manejar el cambio de valores de notas en la cuadrícula masiva
  const handleGradeChange = (studentId: string, evalStructureId: string, value: string) => {
    // Si la celda está bloqueada, no permitir cambios
    if (isLocked) return;

    setGrades(prev => {
      const studentGrades = { ...prev[studentId] };
      const currentData = { ...studentGrades[evalStructureId] };

      // Limitar entradas y validar formato de escala
      let sanitizedVal = value;
      let calculatedLetter = '';

      if (gradeScale?.type === 'competency') {
        // En CNEB se escribe letras: AD, A, B, C (convertimos a valores 4, 3, 2, 1)
        sanitizedVal = value.toUpperCase();
        if (['AD', 'A', 'B', 'C'].includes(sanitizedVal)) {
          calculatedLetter = sanitizedVal;
        } else {
          calculatedLetter = '';
        }
      } else {
        // Numéricos: filtrar caracteres no numéricos
        sanitizedVal = value.replace(/[^0-9.]/g, '');
        const numVal = Number(sanitizedVal);
        if (gradeScale) {
          if (numVal > gradeScale.maxGrade) {
            sanitizedVal = String(gradeScale.maxGrade);
          }
        }
      }

      studentGrades[evalStructureId] = {
        ...currentData,
        value: sanitizedVal,
        letter: calculatedLetter
      };

      return {
        ...prev,
        [studentId]: studentGrades
      };
    });
  };

  // Manejar comentarios de retroalimentación
  const handleCommentChange = (studentId: string, evalStructureId: string, comment: string) => {
    if (isLocked) return;
    setGrades(prev => {
      const studentGrades = { ...prev[studentId] };
      const currentData = { ...studentGrades[evalStructureId] };
      studentGrades[evalStructureId] = {
        ...currentData,
        comment
      };
      return {
        ...prev,
        [studentId]: studentGrades
      };
    });
  };

  // Guardar Calificaciones Masivas (Spreadsheet UX)
  const saveGradesBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tenant || !selectedCourseId) return;

    if (!auditReason.trim()) {
      alert('Por favor, especifica un motivo de justificación para la bitácora de auditoría.');
      return;
    }

    setSaving(true);
    
    // Mapear la matriz de notas a formato de carga del backend
    const gradesPayload: any[] = [];
    Object.entries(grades).forEach(([studentId, structures]) => {
      Object.entries(structures).forEach(([evalStructureId, data]) => {
        if (data.value !== '') {
          // Si es escala por competencias, mapeamos la letra a valor numérico interno
          let numericValue = Number(data.value);
          let letterVal = data.letter;
          
          if (gradeScale?.type === 'competency') {
            if (data.value === 'AD') numericValue = 20;
            else if (data.value === 'A') numericValue = 16;
            else if (data.value === 'B') numericValue = 12;
            else if (data.value === 'C') numericValue = 8;
            letterVal = data.value;
          }

          gradesPayload.push({
            studentId,
            evaluationStructureId: evalStructureId,
            value: numericValue,
            letter: letterVal || null,
            comment: data.comment || null
          });
        }
      });
    });

    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/courses/${selectedCourseId}/grades/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          grades: gradesPayload,
          reason: auditReason,
          academicPeriod: selectedPeriod
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAuditReason('');
        fetchGradesData(selectedCourseId);
        alert('Calificaciones guardadas y registradas con éxito en la Bitácora de Auditoría.');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al guardar calificaciones.');
    } finally {
      setSaving(false);
    }
  };

  // Bloquear / Desbloquear período escolar (Cierre de ciclo)
  const togglePeriodLock = async () => {
    if (!token || !tenant || !selectedCourseId) return;
    const confirmMsg = isLocked
      ? '¿Estás seguro de reabrir el período para este curso? Los profesores podrán modificar notas.'
      : '¿Estás seguro de CERRAR y bloquear el período escolar? Se congelarán las calificaciones oficiales y se emitirán los boletines finales.';
    
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/courses/${selectedCourseId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          isLocked: !isLocked,
          academicPeriod: selectedPeriod
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsLocked(data.isLocked);
        fetchGradesData(selectedCourseId);
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Abrir y cargar panel de configuración de pesos dinámicos
  const openWeightsConfig = () => {
    setTempWeights(evalStructures.map(es => ({ ...es })));
    setShowWeightsModal(true);
  };

  // Agregar nuevo tipo de evaluación al panel de pesos
  const addNewWeightRow = () => {
    setTempWeights(prev => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        name: 'Nueva Evaluación',
        weight: 0
      }
    ]);
  };

  // Eliminar tipo de evaluación del panel de pesos
  const removeWeightRow = (id: string) => {
    setTempWeights(prev => prev.filter(w => w.id !== id));
  };

  // Modificar peso o nombre
  const handleTempWeightChange = (id: string, field: 'name' | 'weight', value: any) => {
    setTempWeights(prev => prev.map(w => {
      if (w.id === id) {
        return {
          ...w,
          [field]: field === 'weight' ? Number(value) : value
        };
      }
      return w;
    }));
  };

  // Guardar configuración de pesos dinámicos en la API
  const saveWeightsConfig = async () => {
    if (!token || !tenant || !selectedCourseId) return;

    // Validar suma del 100%
    const sum = tempWeights.reduce((acc, w) => acc + w.weight, 0);
    if (sum !== 100) {
      alert(`La suma total de ponderaciones debe ser exactamente 100%. Actualmente es del ${sum}%. Por favor ajuste.`);
      return;
    }

    setSavingWeights(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant.id}/courses/${selectedCourseId}/weights`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          weights: tempWeights
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowWeightsModal(false);
        fetchGradesData(selectedCourseId);
        alert('Ponderaciones y pesos dinámicos actualizados correctamente en el curso.');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al guardar ponderaciones.');
    } finally {
      setSavingWeights(false);
    }
  };

  // Cargar y abrir Libreta de Calificaciones imprimible
  const openReportCard = async (student: Student) => {
    setSelectedStudentForReport(student);
    setShowReportCardModal(true);
    setLoadingReportCard(true);
    setReportCardData(null);

    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenant?.id}/students/${student.id}/report-card?academicPeriod=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setReportCardData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReportCard(false);
    }
  };

  // Calcular el promedio acumulado en la fila en base a los pesos
  const calculateRowAverage = (studentId: string) => {
    const studentGrades = grades[studentId];
    if (!studentGrades) return 0;

    let weightedSum = 0;
    let totalWeightUsed = 0;

    evalStructures.forEach(es => {
      const grade = studentGrades[es.id];
      if (grade && grade.value !== '') {
        let numericValue = Number(grade.value);
        if (gradeScale?.type === 'competency') {
          if (grade.value === 'AD') numericValue = 20;
          else if (grade.value === 'A') numericValue = 16;
          else if (grade.value === 'B') numericValue = 12;
          else if (grade.value === 'C') numericValue = 8;
        }
        weightedSum += numericValue * (es.weight / 100);
        totalWeightUsed += es.weight;
      }
    });

    if (totalWeightUsed === 0) return 0;
    // Escalamos al 100% de la porción de notas completada
    return parseFloat((weightedSum * (100 / totalWeightUsed)).toFixed(2));
  };

  // Convertir promedio numérico a Letras/Competencias según la escala
  const getAverageRepresentation = (studentId: string) => {
    const avg = calculateRowAverage(studentId);
    if (avg === 0) return '-';

    if (gradeScale?.type === 'competency') {
      if (avg >= 17) return 'AD (Destacado)';
      if (avg >= 14) return 'A (Logrado)';
      if (avg >= 11) return 'B (En Proceso)';
      return 'C (En Inicio)';
    }

    return String(avg);
  };

  // Obtener color dinámico del promedio para la UX premium
  const getAverageColorClass = (avg: number) => {
    if (avg === 0) return 'text-slate-400 bg-slate-50 border-slate-100';
    
    let passing = 11;
    if (gradeScale?.type === 'numeric-100') passing = 60;
    if (gradeScale?.type === 'competency') passing = 11; // Equivale a 'B'

    if (avg >= passing) {
      return 'text-green-700 bg-green-50 border-green-150 font-black';
    }
    return 'text-red-700 bg-red-50 border-red-150 font-black';
  };

  // Manejo de la navegación por teclado tipo Excel (Spreadsheet key navigation)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    studentIdx: number, 
    evalIdx: number
  ) => {
    let targetStudentIdx = studentIdx;
    let targetEvalIdx = evalIdx;

    if (e.key === 'ArrowDown') {
      targetStudentIdx = Math.min(studentIdx + 1, students.length - 1);
    } else if (e.key === 'ArrowUp') {
      targetStudentIdx = Math.max(studentIdx - 1, 0);
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
      targetEvalIdx = Math.min(evalIdx + 1, evalStructures.length - 1);
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      targetEvalIdx = Math.max(evalIdx - 1, 0);
    } else {
      return; // Ignorar el resto
    }

    e.preventDefault();
    const targetStudent = filteredStudents[targetStudentIdx];
    const targetEval = evalStructures[targetEvalIdx];
    if (targetStudent && targetEval) {
      const key = `${targetStudent.id}-${targetEval.id}`;
      const targetInput = gridInputsRef.current[key];
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
    }
  };

  // Filtrado local de estudiantes
  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.enrollmentNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* 1. ENCABEZADO Y SELECTORES */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -z-10" />
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <Award className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C2C35]">Registro y Control de Calificaciones</h1>
            <p className="text-xs text-slate-400">Cuaderno pedagógico de notas masivo para docentes con auditoría en tiempo real y emisión de boletines.</p>
          </div>
        </div>

        {/* Selectores */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider pl-1">Curso / Asignatura</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-[#6B8E4E] transition-all min-w-[200px]"
            >
              {coursesList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider pl-1">Periodo Escolar</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-[#6B8E4E]"
            >
              <option value="2026-I">Bimestre 2026-I</option>
              <option value="2026-II">Bimestre 2026-II</option>
              <option value="2026-III">Bimestre 2026-III</option>
            </select>
          </div>

          <div className="flex flex-col justify-end h-[38px] pt-1">
            <button
              onClick={openWeightsConfig}
              className="px-3.5 h-[34px] bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl border border-slate-200 flex items-center gap-1.5 text-xs font-extrabold cursor-pointer transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              Ponderaciones
            </button>
          </div>
        </div>
      </div>

      {/* 2. CARD DE ESTADO Y BLOQUEO */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* Estado del Periodo */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm md:col-span-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isLocked 
                ? 'bg-red-50 text-red-500 border-red-150' 
                : 'bg-green-50 text-green-500 border-green-150'
            }`}>
              {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800">
                  Estado del Periodo: {isLocked ? 'Bloqueado / Cerrado' : 'Abierto y Modificable'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                  isLocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {isLocked ? 'Cierre Oficial' : 'Edición Libre'}
                </span>
              </div>
              <p className="text-[10px] text-slate-450 max-w-lg">
                {isLocked 
                  ? 'Las calificaciones de esta materia han sido firmadas oficialmente. Solo la dirección escolar puede reabrir el período para realizar correcciones.' 
                  : 'Los docentes pueden cargar, modificar y registrar calificaciones de exámenes y tareas diariamente. Los cambios se registran en la bitácora.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full sm:w-auto">
            {user?.roleId === 'r-superadmin' || user?.roleName === 'Admin' ? (
              <button
                onClick={togglePeriodLock}
                className={`w-full sm:w-auto px-4 py-2 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  isLocked 
                    ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm' 
                    : 'bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-md'
                }`}
              >
                {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {isLocked ? 'Reabrir Periodo' : 'Cerrar Periodo (Lock)'}
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Solo Admins pueden cerrar periodo
              </div>
            )}
          </div>
        </div>

        {/* Info Escala */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm md:col-span-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[8px] font-black text-slate-450 uppercase tracking-wider block">Escala de Calificaciones Activa</span>
            <span className="text-sm font-black text-slate-800 block leading-snug">{gradeScale?.name || 'Vigesimal'}</span>
            <div className="flex gap-2 text-[10px] font-bold text-slate-400 mt-0.5">
              <span>Mín: {gradeScale?.minGrade}</span>
              <span>•</span>
              <span className="text-[#6B8E4E]">Aprobación: {gradeScale?.passingGrade}</span>
              <span>•</span>
              <span>Máx: {gradeScale?.maxGrade}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-450 border border-slate-100">
            <FileText className="w-4.5 h-4.5" />
          </div>
        </div>

      </section>

      {/* 3. PLANILLA DE NOTAS (SPREADSHEET UX) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Cabecera de Tabla (Controles locales) */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-72">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Filtrar por alumno..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs placeholder-slate-400 focus:outline-none focus:border-[#6B8E4E] transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={fetchAuditLogs}
              className="px-3.5 py-2 hover:bg-slate-100 text-slate-650 border border-slate-200 bg-white rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
            >
              <History className="w-4 h-4 text-slate-400" />
              Historial de Auditoría
            </button>
            
            <button
              onClick={() => setShowAuditDrawer(true)}
              className="hidden" // Para abrir drawer desde código
              id="open-audit-drawer"
            />
          </div>
        </div>

        {/* Planilla de Hoja de Cálculo */}
        {loading ? (
          <div className="py-24 text-center text-xs text-slate-450 font-bold flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#6B8E4E]" />
            Cargando planilla pedagógica de notas...
          </div>
        ) : evalStructures.length === 0 ? (
          <div className="py-24 text-center text-xs text-slate-400 font-bold border-b border-slate-100 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            No hay estructuras de evaluación creadas para esta asignatura.
            <button
              onClick={openWeightsConfig}
              className="mt-3 px-4 py-2 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Configurar Ponderaciones Iniciales
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto select-none">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-left bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-5 min-w-[240px] sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100">Alumno / Documento</th>
                  {evalStructures.map((es, index) => (
                    <th key={es.id} className="py-3 px-4 min-w-[130px] border-r border-slate-100">
                      <div className="flex flex-col">
                        <span>{es.name}</span>
                        <span className="text-[#6B8E4E] text-[9px] font-black lowercase tracking-normal">Peso: {es.weight}%</span>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-4 min-w-[120px] text-center border-r border-slate-100">Promedio Acum.</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={evalStructures.length + 3} className="py-12 text-center text-slate-400 font-bold">
                      Ningún estudiante matriculado coincide con el filtro de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu, sIdx) => {
                    const rowAvg = calculateRowAverage(stu.id);
                    const avgRep = getAverageRepresentation(stu.id);
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Nombre sticky */}
                        <td className="py-3.5 px-5 sticky left-0 bg-white font-bold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100 z-10 flex flex-col justify-center">
                          <span className="truncate max-w-[200px]">{stu.lastName}, {stu.firstName}</span>
                          <span className="font-mono text-[9px] text-slate-400 mt-0.5">{stu.enrollmentNumber}</span>
                        </td>

                        {/* Celdas de Calificaciones interactiva */}
                        {evalStructures.map((es, eIdx) => {
                          const grade = grades[stu.id]?.[es.id] || { value: '', letter: '', comment: '' };
                          const key = `${stu.id}-${es.id}`;
                          const isInvalid = grade.value !== '' && 
                            gradeScale?.type === 'competency' && 
                            !['AD', 'A', 'B', 'C'].includes(grade.value);

                          return (
                            <td key={es.id} className="py-2.5 px-3 border-r border-slate-100 relative group/cell">
                              <div className="flex items-center gap-1">
                                <input
                                  ref={el => { gridInputsRef.current[key] = el; }}
                                  type="text"
                                  disabled={isLocked}
                                  value={grade.value}
                                  onChange={(e) => handleGradeChange(stu.id, es.id, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, sIdx, eIdx)}
                                  placeholder={gradeScale?.type === 'competency' ? 'Letra' : 'Nota'}
                                  className={`w-full px-2 py-1 text-center font-extrabold rounded-lg border text-xs focus:outline-none transition-all ${
                                    isLocked 
                                      ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                                      : isInvalid 
                                        ? 'bg-red-50 border-red-200 text-red-700' 
                                        : grade.value !== ''
                                          ? 'border-slate-200 focus:border-[#6B8E4E] bg-slate-50/50 focus:bg-white text-slate-800'
                                          : 'border-slate-150 border-dashed focus:border-dashed focus:border-[#6B8E4E] bg-white'
                                  }`}
                                />
                                
                                {/* Comentarios de Retroalimentación en Celda */}
                                {!isLocked && (
                                  <input 
                                    type="text"
                                    placeholder="..."
                                    title="Feedback de evaluación"
                                    value={grade.comment}
                                    onChange={(e) => handleCommentChange(stu.id, es.id, e.target.value)}
                                    className="w-12 px-1 py-0.5 border border-slate-200 focus:border-[#6B8E4E] focus:outline-none rounded text-[9px] bg-slate-50/20 text-slate-500 hover:w-32 focus:w-32 focus:absolute focus:right-2 focus:z-20 transition-all font-medium placeholder-slate-350"
                                  />
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Promedio Acumulado */}
                        <td className="py-2.5 px-4 text-center border-r border-slate-100 bg-slate-50/30">
                          <span className={`px-3 py-1 rounded-xl text-[11px] font-black border tracking-wide select-none ${getAverageColorClass(rowAvg)}`}>
                            {avgRep}
                          </span>
                        </td>

                        {/* Acciones (Boletín individual) */}
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => openReportCard(stu)}
                            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-650 border border-slate-200 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer w-full transition-all hover:scale-[1.01]"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Ver Boletín
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. GUARDADO DE PLANILLA DE NOTAS (AUDITORÍA AUDIT LOG MANDATORY) */}
        {!isLocked && evalStructures.length > 0 && (
          <form onSubmit={saveGradesBulk} className="p-6 border-t border-slate-150 bg-slate-50 flex flex-col md:flex-row items-end justify-between gap-6 shrink-0">
            <div className="space-y-2 w-full md:max-w-2xl">
              <label className="text-[10px] font-black uppercase text-[#6B8E4E] tracking-wider flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                Justificación de Guardado (Requisito de Auditoría EdTech)
              </label>
              <textarea 
                rows={1}
                required
                placeholder="Indique el motivo del guardado (ej: Carga de calificaciones correspondientes al Examen del Segundo Parcial)..."
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#6B8E4E] focus:ring-2 focus:ring-[#6B8E4E]/10 transition-all font-medium resize-none shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={saving || savingWeights}
              className="w-full md:w-auto px-5 py-3 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sincronizando notas...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Planilla Escolar
                </>
              )}
            </button>
          </form>
        )}

      </div>

      {/* 5. MODAL CONFIGURACIÓN PESOS Y PONDERACIONES (PESOS DINÁMICOS) */}
      {showWeightsModal && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-up max-h-[85vh] flex flex-col">
            
            {/* Cabecera */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#6B8E4E]" />
                <div>
                  <h3 className="text-base font-black text-[#1C2C35]">Ponderaciones y Estructura</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Asigne pesos dinámicos a las evaluaciones. La suma debe dar 100%.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWeightsModal(false)}
                className="p-1 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition-all cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-700">Tipos de Evaluación</span>
                <button
                  type="button"
                  onClick={addNewWeightRow}
                  className="px-2.5 py-1 bg-[#6B8E4E]/10 hover:bg-[#6B8E4E]/20 text-[#6B8E4E] font-bold text-[10px] rounded-lg border border-[#6B8E4E]/25 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Tipo
                </button>
              </div>

              <div className="space-y-2.5">
                {tempWeights.map((w, index) => (
                  <div key={w.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 shadow-inner">
                    <input 
                      type="text"
                      required
                      value={w.name}
                      onChange={(e) => handleTempWeightChange(w.id, 'name', e.target.value)}
                      placeholder="Nombre (ej: Tareas)"
                      className="flex-1 px-3 py-1.5 border border-slate-250 rounded-xl text-xs bg-white focus:outline-none focus:border-[#6B8E4E] font-bold text-slate-800"
                    />
                    
                    <div className="w-24 relative flex items-center">
                      <input 
                        type="number"
                        min={0}
                        max={100}
                        required
                        value={w.weight}
                        onChange={(e) => handleTempWeightChange(w.id, 'weight', e.target.value)}
                        className="w-full pr-7 pl-3 py-1.5 border border-slate-250 rounded-xl text-xs bg-white text-center focus:outline-none focus:border-[#6B8E4E] font-black text-slate-850"
                      />
                      <span className="absolute right-3 text-[11px] font-black text-slate-400">%</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeWeightRow(w.id)}
                      className="p-1.5 hover:bg-red-50 text-red-500 border border-slate-200 hover:border-red-200 rounded-xl cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Validación de suma */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-black shrink-0 ${
                tempWeights.reduce((acc, w) => acc + w.weight, 0) === 100
                  ? 'bg-green-50 text-green-700 border-green-200/50'
                  : 'bg-amber-50 text-amber-700 border-amber-200/50'
              }`}>
                <span>Total Ponderación Sumado:</span>
                <span className="text-sm font-black">{tempWeights.reduce((acc, w) => acc + w.weight, 0)}% (Debe ser 100%)</span>
              </div>
            </div>

            {/* Acciones */}
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowWeightsModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveWeightsConfig}
                className="px-5 py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white rounded-xl shadow-md hover:scale-[1.01] transition-all cursor-pointer"
              >
                Guardar Configuración
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. DRAWER LATERAL HISTORIAL DE AUDITORÍA DE CALIFICACIONES */}
      {showAuditDrawer && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm z-[999] flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-slide-in relative border-l border-slate-100">
            
            {/* Cabecera Drawer */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#6B8E4E]" />
                <div>
                  <h3 className="text-base font-black text-slate-800">Bitácora de Auditoría de Notas</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Control de cambios completo de calificaciones de este periodo.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAuditDrawer(false)}
                className="p-1 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition-all cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de Logs */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingAudit ? (
                <div className="py-24 text-center text-xs text-slate-450 font-bold flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#6B8E4E]" />
                  Recuperando logs de trazabilidad...
                </div>
              ) : auditLogsList.length === 0 ? (
                <div className="py-24 text-center text-xs text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl">
                  No se registran modificaciones de calificaciones en este curso.
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogsList.map((log) => (
                    <div key={log.id} className="bg-white border border-slate-150 p-4 rounded-2xl shadow-sm relative overflow-hidden flex flex-col gap-2.5">
                      {/* Top info */}
                      <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-800 text-xs">{log.studentName}</span>
                          <span className="text-[10px] text-slate-450 mt-0.5">Evaluación: <strong className="text-slate-650 font-bold">{log.evaluationName}</strong></span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 font-bold">{new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>

                      {/* Grade values comparison */}
                      <div className="flex items-center gap-4 bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl justify-center font-mono">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-slate-400 uppercase font-black">Anterior</span>
                          <span className="text-xs font-bold text-slate-500">{log.previousValue !== null ? `${log.previousValue}${log.previousLetter ? ` (${log.previousLetter})` : ''}` : 'VACÍO'}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] text-[#6B8E4E] uppercase font-black">Nuevo</span>
                          <span className="text-xs font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-150">{log.newValue}{log.newLetter ? ` (${log.newLetter})` : ''}</span>
                        </div>
                      </div>

                      {/* Reason and actor */}
                      <div className="flex flex-col gap-1 text-[11px] font-medium text-slate-600 bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/35">
                        <span className="text-[8px] font-black uppercase text-amber-700 tracking-wider">Justificación del Docente</span>
                        <p className="leading-snug">{log.reason}</p>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold self-end">
                        <span>Autor:</span>
                        <span className="text-slate-600">{log.changedBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Drawer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 7. MODAL IMPRESIÓN/PREVISUALIZACIÓN BOLETÍN Y LIBRETA DE CALIFICACIONES (PDF @media print) */}
      {showReportCardModal && selectedStudentForReport && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999] overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-up max-h-[90vh] flex flex-col my-8">
            
            {/* Cabecera Boletín */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#6B8E4E]" />
                <div>
                  <h3 className="text-base font-black text-slate-800">Previsualización de Libreta / Boletín</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Estudiante: <strong className="text-slate-600">{selectedStudentForReport.lastName}, {selectedStudentForReport.firstName}</strong></p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / PDF
                </button>
                <button 
                  onClick={() => setShowReportCardModal(false)}
                  className="p-1.5 bg-slate-200 hover:bg-slate-350 text-slate-500 rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo del Boletín Oficial */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6" id="report-card-print-area">
              
              {loadingReportCard ? (
                <div className="py-24 text-center text-xs text-slate-450 font-bold flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#6B8E4E]" />
                  Generando boletín académico oficial...
                </div>
              ) : !reportCardData ? (
                <div className="py-24 text-center text-xs text-slate-400 font-bold">
                  Error al calcular las notas oficiales de la libreta.
                </div>
              ) : (
                <article className="space-y-6 max-w-3xl mx-auto border-2 border-slate-150 p-6 rounded-3xl shadow-sm bg-white print:border-0 print:p-0 print:shadow-none">
                  
                  {/* Membrete de la Escuela */}
                  <header className="flex justify-between items-center border-b-2 border-slate-800 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-[#6B8E4E] text-base shrink-0">
                        {reportCardData.tenant?.logoUrl ? (
                          <img src={reportCardData.tenant.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                        ) : 'SE'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-base text-slate-900 tracking-wide">{reportCardData.tenant?.name || 'SincroEdu Premium College'}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{reportCardData.tenant?.address || 'Lima, Perú'} • {reportCardData.tenant?.phone || ''}</span>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col">
                      <span className="font-black text-sm text-[#1C2C35] tracking-wider uppercase">Libreta de Notas</span>
                      <span className="text-[10px] text-[#6B8E4E] font-black uppercase tracking-wider mt-0.5">Periodo: {reportCardData.academicPeriod}</span>
                    </div>
                  </header>

                  {/* Datos del Estudiante */}
                  <section className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Estudiante</span>
                      <strong className="text-slate-850 font-extrabold block text-sm">{reportCardData.student.lastName}, {reportCardData.student.firstName}</strong>
                    </div>
                    <div className="space-y-0.5 font-mono">
                      <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Nro. Matrícula</span>
                      <strong className="text-slate-700 block font-bold">{reportCardData.student.enrollmentNumber}</strong>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Documento Identidad</span>
                      <strong className="text-slate-700 block font-bold">{reportCardData.student.documentId || 'DNI'}</strong>
                    </div>
                  </section>

                  {/* Detalle Curricular y Notas */}
                  <section className="space-y-4">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-800 text-left text-[9px] font-black uppercase text-slate-950 tracking-wider">
                          <th className="py-2.5 px-3 min-w-[200px]">Curso Asignado</th>
                          <th className="py-2.5 px-2 text-center min-w-[80px]">Créditos</th>
                          <th className="py-2.5 px-2 text-center">Evaluaciones Parciales</th>
                          <th className="py-2.5 px-3 text-center min-w-[100px]">Promedio Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {reportCardData.courseAverages.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                              No se registran asignaturas evaluadas en este periodo escolar.
                            </td>
                          </tr>
                        ) : (
                          reportCardData.courseAverages.map((ca: any) => (
                            <tr key={ca.courseId} className="align-middle">
                              <td className="py-3.5 px-3 font-bold text-slate-900">
                                <span>{ca.courseName}</span>
                                <span className="font-mono text-[9px] text-slate-400 block font-medium mt-0.5">Código: {ca.courseCode}</span>
                              </td>
                              <td className="py-3.5 px-2 text-center text-slate-650 font-bold">{ca.credits}</td>
                              <td className="py-3.5 px-2">
                                <div className="flex flex-wrap gap-2.5 justify-start">
                                  {ca.grades.map((gr: any, gIdx: number) => (
                                    <div key={gIdx} className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px]">
                                      <span className="text-slate-450 font-semibold">{gr.evaluationName}:</span>
                                      <span className="font-black text-slate-700">{gr.letter || gr.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <span className="px-3 py-1 font-black text-xs border rounded-xl select-none text-slate-800 bg-slate-50 border-slate-200">
                                  {ca.averageLetter !== '-' ? `${ca.averageLetter} (${ca.average})` : ca.average}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </section>

                  {/* Resumen y GPA Consolidado */}
                  <footer className="border-t-2 border-slate-800 pt-5 flex justify-between items-start gap-4">
                    <div className="space-y-1.5 max-w-sm text-[10px] text-slate-400 font-medium">
                      <span className="font-black uppercase text-slate-700 block tracking-wide">Leyenda de Escala Oficial</span>
                      <p><strong>AD</strong>: Destacado (17-20) • <strong>A</strong>: Logrado (14-16) • <strong>B</strong>: En Proceso (11-13) • <strong>C</strong>: En Inicio (0-10)</p>
                      <p>GPA (Grade Point Average) calculado ponderadamente por créditos académicos.</p>
                    </div>

                    <div className="bg-slate-900 text-white p-4.5 rounded-2xl flex items-center gap-6 shrink-0 shadow-md">
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-wider font-black text-slate-400 block">Créditos Evaluados</span>
                        <strong className="text-base font-extrabold block text-center text-white">{reportCardData.totalCredits}</strong>
                      </div>
                      <div className="h-8 w-[1px] bg-white/10" />
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-wider font-black text-[#6B8E4E] block">GPA Acumulado</span>
                        <strong className="text-lg font-black block text-center text-green-400">{reportCardData.cumulativeGpa.toFixed(2)}</strong>
                      </div>
                    </div>
                  </footer>

                  {/* Firmas oficiales de impresión */}
                  <div className="pt-16 hidden print:grid grid-cols-2 gap-12 text-center text-[10px] font-bold text-slate-400">
                    <div className="border-t border-slate-300 pt-2.5">
                      <span>Coordinación Pedagógica</span>
                    </div>
                    <div className="border-t border-slate-300 pt-2.5">
                      <span>Dirección de SincroEdu</span>
                    </div>
                  </div>

                </article>
              )}

            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50 shrink-0">
              <button
                onClick={() => setShowReportCardModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Cerrar Libreta
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ESTILOS DE IMPRESIÓN EXCLUSIVOS PARA EL BOLETÍN DE NOTAS PRINT CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #report-card-print-area, #report-card-print-area * {
            visibility: visible;
          }
          #report-card-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
          }
          .fixed, header, aside, button, nav {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
