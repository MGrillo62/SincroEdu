'use client';

import { getApiUrl } from '@/lib/config';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { 
  Target,
  Plus,
  Users,
  TrendingUp,
  CreditCard,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  User,
  MapPin,
  Calendar,
  AlertTriangle,
  Award,
  Settings,
  History,
  FolderOpen,
  LogOut,
  X,
  Save,
  MessageSquare,
  FileText,
  Clock,
  Compass,
  ArrowRight,
  TrendingDown,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface Lead {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  parentName: string;
  email: string;
  phone: string;
  gradeInterested: string;
  source: 'web' | 'referral' | 'social_media' | 'walk_in' | 'phone_call';
  status: 'new' | 'contacted' | 'tour_scheduled' | 'evaluation' | 'approved' | 'enrolled' | 'lost';
  lostReason?: string;
  assignedUserId?: string;
  createdAt: string;
  updatedAt: string;
}

interface LeadActivity {
  id: string;
  leadId: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'evaluation' | 'system';
  summary: string;
  details?: string;
  createdBy: string;
  createdAt: string;
}

interface LeadTask {
  id: string;
  leadId: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed';
  assignedTo: string;
  createdAt: string;
}

interface CRMMetrics {
  totalLeads: number;
  conversionRate: number;
  projectedPipeline: number;
  sourcesDistribution: {
    web: number;
    referral: number;
    social_media: number;
    walk_in: number;
    phone_call: number;
  };
  pendingTasks: number;
  activeLeads: number;
}

// 7 Etapas del pipeline escolar en orden
const PIPELINE_STAGES = [
  { id: 'new', name: 'Prospecto', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  { id: 'contacted', name: 'Contactado', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  { id: 'tour_scheduled', name: 'Visita Guiada', color: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  { id: 'evaluation', name: 'Evaluación', color: 'bg-purple-50 text-purple-700 border-purple-100', dot: 'bg-purple-500' },
  { id: 'approved', name: 'Admitido', color: 'bg-teal-50 text-teal-700 border-teal-100', dot: 'bg-teal-500' },
  { id: 'enrolled', name: 'Matriculado', color: 'bg-green-50 text-green-700 border-green-100', dot: 'bg-green-500' },
  { id: 'lost', name: 'Perdido', color: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' }
];

export default function CRMPage() {
  const { tenant, token } = useAuthStore();
  const router = useRouter();

  // Estados del CRM
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<CRMMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Modales y Formularios
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Campos de Nuevo Lead
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gradeInterested, setGradeInterested] = useState('Primaria 1°');
  const [source, setSource] = useState<'web' | 'referral' | 'social_media' | 'walk_in' | 'phone_call'>('web');

  // Campos de Edición de Lead
  const [editParentName, setEditParentName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGrade, setEditGrade] = useState('');

  // Timeline y Tareas en el Cajón
  const [timeline, setTimeline] = useState<LeadActivity[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Expresar Nueva Interacción
  const [interactionType, setInteractionType] = useState<'call' | 'email' | 'meeting' | 'note'>('call');
  const [interactionSummary, setInteractionSummary] = useState('');
  const [interactionDetails, setInteractionDetails] = useState('');

  // Expresar Nueva Tarea
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Motivo de Pérdida
  const [isLostReasonOpen, setIsLostReasonOpen] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState('');
  const [pendingLostLeadId, setPendingLostLeadId] = useState<string | null>(null);

  const totalLeadsCount = leadsList.length;

  // Cargar datos del servidor
  const fetchLeads = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/crm/leads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLeadsList(data);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/crm/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLeads();
      fetchMetrics();
    }
  }, [token]);

  // Cargar Timeline y Tareas del lead seleccionado
  const loadLeadDetails = async (lead: Lead) => {
    if (!token) return;
    setLoadingTimeline(true);
    try {
      // Timeline
      const timelineRes = await fetch(`${getApiUrl()}/crm/leads/${lead.id}/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const timelineData = await timelineRes.json();
      if (timelineRes.ok) {
        setTimeline(timelineData);
      }

      // Tareas
      const tasksRes = await fetch(`${getApiUrl()}/crm/leads/${lead.id}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tasksData = await tasksRes.json();
      if (tasksRes.ok) {
        setTasks(tasksData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Abrir cajón del lead
  const handleOpenLeadDrawer = (lead: Lead) => {
    setSelectedLead(lead);
    setEditParentName(lead.parentName);
    setEditEmail(lead.email);
    setEditPhone(lead.phone);
    setEditGrade(lead.gradeInterested);
    setIsDrawerOpen(true);
    loadLeadDetails(lead);
  };

  // Guardar Edición del Lead en Cajón
  const handleSaveLeadEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedLead) return;

    try {
      const res = await fetch(`${getApiUrl()}/crm/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          parentName: editParentName,
          email: editEmail,
          phone: editPhone,
          gradeInterested: editGrade
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Actualizar leads locales
        setLeadsList(prev => prev.map(l => l.id === selectedLead.id ? data : l));
        setSelectedLead(data);
        loadLeadDetails(data);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mutar Etapa del Lead
  const handleMutateStage = async (leadId: string, newStage: string) => {
    if (!token) return;

    // Si es etapa perdida (lost), requerir el modal de motivo
    if (newStage === 'lost') {
      setPendingLostLeadId(leadId);
      setLostReasonInput('');
      setIsLostReasonOpen(true);
      return;
    }

    try {
      const res = await fetch(`${getApiUrl()}/crm/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStage })
      });
      const data = await res.json();
      if (res.ok) {
        setLeadsList(prev => prev.map(l => l.id === leadId ? data : l));
        fetchMetrics();
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(data);
          loadLeadDetails(data);
        }
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Guardar Descarte de Lead (Lost)
  const handleSaveLostReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pendingLostLeadId || !lostReasonInput.trim()) return;

    try {
      const res = await fetch(`${getApiUrl()}/crm/leads/${pendingLostLeadId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'lost', lostReason: lostReasonInput })
      });
      const data = await res.json();
      if (res.ok) {
        setLeadsList(prev => prev.map(l => l.id === pendingLostLeadId ? data : l));
        setIsLostReasonOpen(false);
        fetchMetrics();
        if (selectedLead && selectedLead.id === pendingLostLeadId) {
          setSelectedLead(data);
          loadLeadDetails(data);
        }
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Crear Nuevo Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const res = await fetch(`${getApiUrl()}/crm/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName,
          lastName,
          parentName,
          email,
          phone,
          gradeInterested,
          source
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsNewLeadOpen(false);
        setFirstName('');
        setLastName('');
        setParentName('');
        setEmail('');
        setPhone('');
        fetchLeads();
        fetchMetrics();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Registrar nueva interacción
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedLead || !interactionSummary.trim()) return;

    try {
      const res = await fetch(`${getApiUrl()}/crm/leads/${selectedLead.id}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: interactionType,
          summary: interactionSummary,
          details: interactionDetails
        })
      });
      if (res.ok) {
        setInteractionSummary('');
        setInteractionDetails('');
        loadLeadDetails(selectedLead);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Registrar nueva tarea
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedLead || !taskTitle.trim() || !taskDueDate) return;

    try {
      const res = await fetch(`${getApiUrl()}/crm/leads/${selectedLead.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskTitle,
          dueDate: taskDueDate
        })
      });
      if (res.ok) {
        setTaskTitle('');
        setTaskDueDate('');
        loadLeadDetails(selectedLead);
        fetchMetrics();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle estado de tarea
  const handleToggleTask = async (taskId: string) => {
    if (!token || !selectedLead) return;

    try {
      const res = await fetch(`${getApiUrl()}/crm/leads/${selectedLead.id}/tasks/${taskId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadLeadDetails(selectedLead);
        fetchMetrics();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Redirección y precarga express a Matrículas Oficiales
  const handleRedirectToEnrollment = (lead: Lead) => {
    // Almacenamos en SessionStorage los datos de precarga
    sessionStorage.setItem('sincroedu_lead_enroll_preload', JSON.stringify({
      firstName: lead.firstName,
      lastName: lead.lastName,
      parentName: lead.parentName,
      email: lead.email,
      phone: lead.phone,
      grade: lead.gradeInterested
    }));

    setIsDrawerOpen(false);
    // Redirigir a Expedientes y Matrículas
    router.push('/dashboard/students');
  };

  // Formato español descriptivo de Origen
  const renderSourceBadge = (src: Lead['source']) => {
    const map = {
      web: { name: 'Web', color: 'bg-blue-50 text-blue-700 border-blue-100' },
      referral: { name: 'Recomendado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
      social_media: { name: 'Redes Sociales', color: 'bg-purple-50 text-purple-700 border-purple-100' },
      walk_in: { name: 'Visita Presencial', color: 'bg-amber-50 text-amber-700 border-amber-100' },
      phone_call: { name: 'Llamada', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' }
    };
    const info = map[src] || { name: src, color: 'bg-slate-50 text-slate-700 border-slate-100' };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.color}`}>
        {info.name}
      </span>
    );
  };

  const getSourceIcon = (src: Lead['source']) => {
    switch (src) {
      case 'web': return <Compass className="w-3.5 h-3.5" />;
      case 'referral': return <Users className="w-3.5 h-3.5" />;
      case 'social_media': return <TrendingUp className="w-3.5 h-3.5" />;
      case 'walk_in': return <MapPin className="w-3.5 h-3.5" />;
      case 'phone_call': return <Phone className="w-3.5 h-3.5" />;
      default: return <HelpCircle className="w-3.5 h-3.5" />;
    }
  };

  const formatActivityIcon = (type: LeadActivity['type']) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4 text-indigo-500" />;
      case 'email': return <Mail className="w-4 h-4 text-blue-500" />;
      case 'meeting': return <Users className="w-4 h-4 text-amber-500" />;
      case 'note': return <FileText className="w-4 h-4 text-purple-500" />;
      case 'evaluation': return <Award className="w-4 h-4 text-teal-500" />;
      case 'system': return <Settings className="w-4 h-4 text-slate-500" />;
      default: return <MessageSquare className="w-4 h-4 text-slate-500" />;
    }
  };

  // Color de acento de la escuela
  const activeColor = tenant?.primaryColor || '#6B8E4E';

  return (
    <div className="space-y-8 font-sans pb-12">
      
      {/* 1. SECCIÓN DE ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(28,44,53,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <Target className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C2C35]">CRM y Captación de Leads</h1>
            <p className="text-xs text-slate-400">Controla el embudo de admisiones de tu escuela y maximiza el índice de conversión de matrículas.</p>
          </div>
        </div>

        <button
          onClick={() => setIsNewLeadOpen(true)}
          className="px-4 py-2.5 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 hover:scale-[1.01] shadow-md transition-all cursor-pointer"
          style={{ backgroundColor: activeColor }}
        >
          <Plus className="w-4 h-4" />
          Nuevo Prospecto (Lead)
        </button>
      </div>

      {/* 2. PANEL DE KPIS Y MÉTRICAS COMERCIALES */}
      {metrics && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {/* KPI 1: Leads Totales */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prospectos Totales</span>
              <span className="text-2xl font-extrabold text-[#1C2C35] block">{metrics.totalLeads} Leads</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                {metrics.activeLeads} en Pipeline activo
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 2: Tasa de Conversión */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Conversión a Matrícula</span>
              <span className="text-2xl font-extrabold text-[#1C2C35] block">{metrics.conversionRate}%</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                Eficiencia de Cierre
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 3: Pipeline Proyectado */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pipeline Estimado</span>
              <span className="text-xl font-extrabold text-[#1C2C35] block">S/. {metrics.projectedPipeline.toLocaleString()}</span>
              <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">Basado en grado de interés</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 4: Tareas de Seguimiento */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Seguimientos Pendientes</span>
              <span className="text-2xl font-extrabold text-[#1C2C35] block">{metrics.pendingTasks} Tareas</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                metrics.pendingTasks > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-50 text-slate-450'
              }`}>
                Acciones Comerciales
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 5: Origen de Canales (CSS Bar Chart) */}
          <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-bold text-[#1C2C35]/50 uppercase tracking-wider block mb-2">Canales de Captación</span>
            
            <div className="space-y-1.5 text-[10px] font-bold text-slate-600">
              {/* Web */}
              <div className="flex items-center gap-2">
                <span className="w-8 text-[9px] text-slate-400">Web</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalLeadsCount > 0 ? (metrics.sourcesDistribution.web / totalLeadsCount) * 100 : 0}%` }} />
                </div>
                <span className="text-right w-4">{metrics.sourcesDistribution.web}</span>
              </div>
              {/* RRSS */}
              <div className="flex items-center gap-2">
                <span className="w-8 text-[9px] text-slate-400">RRSS</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${totalLeadsCount > 0 ? (metrics.sourcesDistribution.social_media / totalLeadsCount) * 100 : 0}%` }} />
                </div>
                <span className="text-right w-4">{metrics.sourcesDistribution.social_media}</span>
              </div>
              {/* Recom. */}
              <div className="flex items-center gap-2">
                <span className="w-8 text-[9px] text-slate-400">Recom</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalLeadsCount > 0 ? (metrics.sourcesDistribution.referral / totalLeadsCount) * 100 : 0}%` }} />
                </div>
                <span className="text-right w-4">{metrics.sourcesDistribution.referral}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. PIPELINE VISUAL (TABLERO KANBAN DE ADMISIONES) */}
      <section className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 shadow-inner">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xs font-black text-[#1C2C35]/85 uppercase tracking-wider block">
            Embudo de Admisiones y Ventas Escolar
          </h2>
          
          <div className="flex gap-2 text-[10px] text-slate-400 font-bold">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-500 block" /> Web
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-50 block" /> Recomendado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-purple-500 block" /> Redes
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-xs text-slate-450 font-bold flex flex-col items-center justify-center gap-2">
            <Clock className="w-8 h-8 animate-spin text-[#6B8E4E]" />
            Cargando leads y pipeline...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 overflow-x-auto select-none min-h-[500px]">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = leadsList.filter(l => l.status === stage.id);
              
              return (
                <div 
                  key={stage.id}
                  className="bg-white rounded-2xl border border-slate-100 flex flex-col min-w-[200px] shadow-sm max-h-[600px] overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 sticky top-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                      <span className="text-[11px] font-black text-[#1C2C35]/90 tracking-wide">
                        {stage.name}
                      </span>
                    </div>
                    <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards Area */}
                  <div className="p-2 space-y-2.5 overflow-y-auto flex-1 bg-slate-50/20 max-h-[500px]">
                    {stageLeads.length === 0 ? (
                      <div className="py-12 text-center text-[10px] text-slate-350 font-bold border-2 border-dashed border-slate-100 rounded-xl">
                        Sin leads aquí
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <div 
                          key={lead.id}
                          className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-[0_1px_4px_rgba(0,0,0,0.015)] hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-2 relative group cursor-pointer"
                          onClick={() => handleOpenLeadDrawer(lead)}
                        >
                          {/* Title & Source */}
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-xs font-black text-[#1C2C35] hover:text-[#6B8E4E] transition-colors leading-tight">
                              {lead.firstName} {lead.lastName}
                            </span>
                            <span className="shrink-0 text-slate-400 group-hover:text-[#6B8E4E] transition-colors">
                              {getSourceIcon(lead.source)}
                            </span>
                          </div>

                          {/* Grade & Parent */}
                          <div className="text-[10px] text-slate-500 font-semibold space-y-0.5">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{lead.parentName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Award className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>Interés: {lead.gradeInterested}</span>
                            </div>
                          </div>

                          {/* Badges footer */}
                          <div className="pt-1.5 flex items-center justify-between border-t border-slate-100 mt-1">
                            {renderSourceBadge(lead.source)}
                            
                            {/* Desplazadores rápidos (Quick move buttons) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                              {/* Izquierda */}
                              {PIPELINE_STAGES.indexOf(stage) > 0 && (
                                <button
                                  onClick={() => {
                                    const prevIdx = PIPELINE_STAGES.indexOf(stage) - 1;
                                    handleMutateStage(lead.id, PIPELINE_STAGES[prevIdx].id);
                                  }}
                                  className="p-1 hover:bg-slate-100 hover:text-[#6B8E4E] text-slate-400 rounded-md transition-colors cursor-pointer"
                                  title="Mover a etapa anterior"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                              )}
                              {/* Derecha */}
                              {PIPELINE_STAGES.indexOf(stage) < PIPELINE_STAGES.length - 1 && (
                                <button
                                  onClick={() => {
                                    const nextIdx = PIPELINE_STAGES.indexOf(stage) + 1;
                                    handleMutateStage(lead.id, PIPELINE_STAGES[nextIdx].id);
                                  }}
                                  className="p-1 hover:bg-slate-100 hover:text-[#6B8E4E] text-slate-400 rounded-md transition-colors cursor-pointer"
                                  title="Mover a etapa siguiente"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Pulsante de pérdida */}
                          {lead.status === 'lost' && lead.lostReason && (
                            <div className="mt-1 text-[8px] bg-red-50 text-red-600 rounded px-1.5 py-0.5 border border-red-100 font-bold truncate">
                              Motivo: {lead.lostReason}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. MODAL: REGISTRAR NUEVO LEAD */}
      {isNewLeadOpen && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-[#1C2C35]">Registrar Prospecto de Admisión</h3>
                <p className="text-xs text-slate-400 mt-0.5">Completa los datos de la familia interesada para iniciar el pipeline.</p>
              </div>
              <button 
                onClick={() => setIsNewLeadOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Nombre del Alumno</label>
                  <input
                    type="text" required placeholder="ej: Mateo" value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Apellido del Alumno</label>
                  <input
                    type="text" required placeholder="ej: Silva" value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Padre, Madre o Apoderado</label>
                <input
                  type="text" required placeholder="ej: Sofía Silva (Madre)" value={parentName}
                  onChange={e => setParentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Correo Electrónico</label>
                  <input
                    type="email" required placeholder="ej: sofia@mail.com" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Teléfono / WhatsApp</label>
                  <input
                    type="tel" required placeholder="ej: +51 987654321" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Grado de Interés</label>
                  <select
                    value={gradeInterested} onChange={e => setGradeInterested(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50/50"
                  >
                    <option value="Primaria 1°">Primaria 1°</option>
                    <option value="Primaria 2°">Primaria 2°</option>
                    <option value="Primaria 3°">Primaria 3°</option>
                    <option value="Primaria 4°">Primaria 4°</option>
                    <option value="Primaria 5°">Primaria 5°</option>
                    <option value="Secundaria 1°">Secundaria 1°</option>
                    <option value="Secundaria 2°">Secundaria 2°</option>
                    <option value="Secundaria 3°">Secundaria 3°</option>
                    <option value="Secundaria 4°">Secundaria 4°</option>
                    <option value="Secundaria 5°">Secundaria 5°</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Canal / Origen de Contacto</label>
                  <select
                    value={source} onChange={e => setSource(e.target.value as any)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50/50"
                  >
                    <option value="web">Formulario Web</option>
                    <option value="social_media">Redes Sociales</option>
                    <option value="referral">Recomendación</option>
                    <option value="walk_in">Visita Presencial</option>
                    <option value="phone_call">Llamada Telefónica</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 justify-end text-xs font-semibold">
                <button
                  type="button" onClick={() => setIsNewLeadOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-white rounded-xl shadow hover:scale-[1.01] transition-transform cursor-pointer"
                  style={{ backgroundColor: activeColor }}
                >
                  Registrar Lead
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: DETALLAR MOTIVO DE DESCARTE (LOST) */}
      {isLostReasonOpen && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-black">Confirmar Descarte de Vacante</h3>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Es necesario registrar el motivo real por el cual el lead no continuará con el ciclo de admisión escolar para fines estratégicos.
            </p>

            <form onSubmit={handleSaveLostReason} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Motivo de Descarte</label>
                <select
                  required
                  value={lostReasonInput}
                  onChange={e => setLostReasonInput(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-slate-50"
                >
                  <option value="">Seleccione una opción...</option>
                  <option value="Motivos económicos / Pensión muy alta">Motivos económicos / Pensión muy alta</option>
                  <option value="Distancia al campus / Movilidad compleja">Distancia al campus / Movilidad compleja</option>
                  <option value="Optó por otra propuesta educativa / Colegio competidor">Optó por otra propuesta educativa / Colegio competidor</option>
                  <option value="Desacuerdo con la currícula / Modelo escolar">Desacuerdo con la currícula / Modelo escolar</option>
                  <option value="Desaprobó la evaluación académica">Desaprobó la evaluación académica</option>
                  <option value="Decisión familiar postergada para el próximo año">Decisión familiar postergada para el próximo año</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2 justify-end text-xs font-semibold">
                <button
                  type="button" onClick={() => setIsLostReasonOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-xl shadow cursor-pointer"
                >
                  Descartar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. DRAWER LATERAL: EXPEDIENTE COMERCIAL Y HISTORIAL TIMELINE (LEAD DRAWER) */}
      {isDrawerOpen && selectedLead && (
        <div className="fixed inset-0 bg-[#1C2C35]/30 backdrop-blur-xs flex justify-end z-[999] animate-fade-in">
          
          {/* Capa de click externo para cerrar */}
          <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />

          {/* Drawer Body */}
          <div className="w-full max-w-xl bg-white h-screen shadow-2xl flex flex-col justify-between border-l border-slate-150 animate-slide-left overflow-hidden">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#1C2C35] leading-tight">
                    Expediente: {selectedLead.firstName} {selectedLead.lastName}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                    Ficha Comercial Multi-Tenant
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-450 cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Core Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* ALERTA DE MATRÍCULA GANADA (CELEBRACIÓN Y INTEGRACIÓN) */}
              {selectedLead.status === 'enrolled' ? (
                <div className="bg-green-50 border border-green-200 p-4.5 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-start gap-2.5 text-green-700">
                    <CheckCircle className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black">¡Prospecto Ganado y Matriculado! 🎉</h4>
                      <p className="text-[11px] text-green-650 leading-relaxed mt-0.5">
                        El pago de la matrícula ha sido validado exitosamente. Ahora puedes transferir la ficha para matricularlo oficialmente como alumno regular del periodo.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRedirectToEnrollment(selectedLead)}
                    className="self-start px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <span>Pre-llenar Matrícula Oficial</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : selectedLead.status === 'lost' ? (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black">Prospecto Descartado (Cierre Perdido)</h4>
                    <p className="text-[11px] text-red-650 leading-relaxed mt-0.5">
                      Ficha comercial inactiva. Motivo de pérdida registrado: <strong className="block mt-1 font-extrabold italic">"{selectedLead.lostReason}"</strong>
                    </p>
                  </div>
                </div>
              ) : null}

              {/* 1. SECTOR EDICIÓN REACTIVA */}
              <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100">
                <h4 className="text-[10px] font-black text-[#1C2C35]/60 uppercase tracking-wider mb-3 block">
                  Información de Contacto
                </h4>

                <form onSubmit={handleSaveLeadEdits} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Padre / Apoderado</label>
                      <input 
                        type="text" value={editParentName} onChange={e => setEditParentName(e.target.value)}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Grado Escolar Interés</label>
                      <input 
                        type="text" value={editGrade} onChange={e => setEditGrade(e.target.value)}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Correo Apoderado</label>
                      <input 
                        type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Teléfono Apoderado</label>
                      <input 
                        type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-3.5 py-2 text-white font-extrabold text-[10px] rounded-lg flex items-center gap-1.5 hover:scale-[1.01] shadow-sm transition-transform cursor-pointer"
                      style={{ backgroundColor: activeColor }}
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar Ficha
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. ACCIONES DE CAMBIO DE ESTADO EN EL EXPEDIENTE */}
              <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100">
                <h4 className="text-[10px] font-black text-[#1C2C35]/60 uppercase tracking-wider mb-2.5 block">
                  Desplazar Etapa de Admisión
                </h4>
                
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map((s) => {
                    const isCurrent = selectedLead.status === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleMutateStage(selectedLead.id, s.id)}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-black tracking-wide transition-all cursor-pointer ${
                          isCurrent 
                            ? 'bg-[#1C2C35] text-white border-transparent shadow'
                            : 'bg-white hover:bg-slate-100 text-[#1C2C35]/70 border-slate-200'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. TAREAS Y RECORDATORIOS DE SEGUIMIENTO */}
              <div className="bg-white rounded-2xl border border-slate-150 p-4.5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black text-[#1C2C35]/80 uppercase tracking-wider flex items-center gap-1">
                    <CheckSquare className="w-4 h-4 text-[#6B8E4E]" />
                    Tareas y Recordatorios de Admisión
                  </h4>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-extrabold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === 'pending').length} pendientes
                  </span>
                </div>

                {/* Lista de tareas */}
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-bold text-center py-4">No hay tareas programadas para este lead.</p>
                  ) : (
                    tasks.map((task) => {
                      const isCompleted = task.status === 'completed';
                      return (
                        <div 
                          key={task.id}
                          className={`flex items-start justify-between p-2.5 rounded-xl border text-[11px] font-semibold transition-all ${
                            isCompleted ? 'bg-slate-50 border-slate-150 text-slate-400' : 'bg-amber-50/20 border-amber-100 text-slate-800'
                          }`}
                        >
                          <div className="flex gap-2.5 items-start">
                            <input 
                              type="checkbox"
                              checked={isCompleted}
                              onChange={() => handleToggleTask(task.id)}
                              className="w-4.5 h-4.5 rounded border-slate-300 accent-[#6B8E4E] cursor-pointer mt-0.5"
                            />
                            <div className="space-y-0.5">
                              <span className={isCompleted ? 'line-through' : 'font-extrabold text-[#1C2C35]'}>
                                {task.title}
                              </span>
                              <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Vence: {task.dueDate.split('-').reverse().join('/')}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isCompleted ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {task.status}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Formulario express de tareas */}
                <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
                  <input 
                    type="text" required placeholder="Nueva tarea: ej: Llamar para confirmar visita" value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    className="sm:col-span-7 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6B8E4E]"
                  />
                  <input 
                    type="date" required value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)}
                    className="sm:col-span-3 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6B8E4E]"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 px-3 py-1.5 text-white font-extrabold text-xs rounded-lg flex items-center justify-center shadow-sm cursor-pointer hover:scale-[1.02] transition-transform"
                    style={{ backgroundColor: activeColor }}
                  >
                    Agregar
                  </button>
                </form>
              </div>

              {/* 4. BITÁCORA / TIMELINE DE INTERACCIONES */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <History className="w-4.5 h-4.5 text-[#6B8E4E]" />
                  <h4 className="text-[10px] font-black text-[#1C2C35]/80 uppercase tracking-wider">
                    Bitácora Comercial y Timeline de Actividades
                  </h4>
                </div>

                {/* Formulario express de interacciones */}
                <form onSubmit={handleAddInteraction} className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3.5">
                  <div className="flex items-center gap-3.5">
                    <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Tipo:</span>
                    
                    <div className="flex gap-2">
                      {(['call', 'email', 'meeting', 'note'] as const).map((t) => (
                        <button
                          key={t} type="button" onClick={() => setInteractionType(t)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black border uppercase tracking-wider cursor-pointer ${
                            interactionType === t
                              ? 'bg-[#1C2C35] text-white border-transparent shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {t === 'call' ? '📞 Llamada' : t === 'email' ? '✉️ Correo' : t === 'meeting' ? '👥 Cita' : '📝 Nota'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input 
                      type="text" required placeholder="Resumen rápido: ej. Llamada telefónica realizada" value={interactionSummary}
                      onChange={e => setInteractionSummary(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E]"
                    />
                    <textarea 
                      rows={2} placeholder="Redactar notas o acuerdos tomados..." value={interactionDetails}
                      onChange={e => setInteractionDetails(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E] resize-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 text-white font-extrabold text-[10px] rounded-lg shadow-sm hover:scale-[1.01] transition-transform cursor-pointer"
                      style={{ backgroundColor: activeColor }}
                    >
                      Registrar Interacción
                    </button>
                  </div>
                </form>

                {/* Timeline display */}
                {loadingTimeline ? (
                  <div className="text-center py-6 text-xs text-slate-450 font-bold">Obteniendo timeline...</div>
                ) : (
                  <div className="pl-4 border-l-2 border-slate-150 space-y-5.5 relative">
                    {timeline.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-bold text-center py-4">No hay interacciones registradas aún.</p>
                    ) : (
                      timeline.map((act) => (
                        <div key={act.id} className="relative group">
                          
                          {/* Dot Icon */}
                          <div className="absolute -left-[25px] top-0 w-5 h-5 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                            {formatActivityIcon(act.type)}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-xs font-black text-[#1C2C35]">
                                {act.summary}
                              </span>
                              <span className="text-[8px] font-black uppercase text-slate-400">
                                {act.type}
                              </span>
                            </div>

                            {act.details && (
                              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                {act.details}
                              </p>
                            )}

                            {/* Meta footer */}
                            <div className="flex gap-2 text-[9px] text-slate-400 font-bold">
                              <span>Por: {act.createdBy}</span>
                              <span>•</span>
                              <span>
                                {new Date(act.createdAt).toLocaleDateString('es-ES')} - {new Date(act.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>

            </div>

            {/* Footer buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex gap-3 text-xs font-semibold justify-end">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-350 text-slate-650 rounded-xl cursor-pointer transition-colors"
              >
                Cerrar Expediente
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
