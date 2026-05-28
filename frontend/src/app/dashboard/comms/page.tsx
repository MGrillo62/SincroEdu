'use client';

import { getApiUrl } from '@/lib/config';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import SelectSearch from '@/components/ui/select-search';
import { 
  MessageSquare,
  Plus,
  Mail,
  Phone,
  Send,
  Users,
  Award,
  AlertTriangle,
  Settings,
  History,
  FileText,
  Clock,
  Compass,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  X,
  PlusCircle,
  FileDown,
  Info,
  Calendar,
  Check,
  Search,
  BookOpen
} from 'lucide-react';

interface CommunicationMessage {
  id: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  subject: string;
  body: string;
  category: 'general' | 'academic' | 'billing' | 'emergency' | 'event';
  targetGroup: 'all' | 'teachers' | 'parents' | 'students' | 'grade' | 'individual';
  targetGrade?: string;
  attachmentUrl?: string;
  deliveryChannels: ('in_app' | 'email' | 'whatsapp')[];
  createdAt: string;
  inAppStatus?: 'unread' | 'read';
  analytics?: {
    totalRecipients: number;
    readCount: number;
    readRate: number;
  };
}

interface CommunicationRecipient {
  id: string;
  messageId: string;
  recipientId: string;
  recipientName: string;
  recipientRole: 'admin' | 'teacher' | 'parent' | 'student';
  inAppStatus: 'unread' | 'read';
  emailStatus: 'pending' | 'sent' | 'failed' | 'not_requested';
  whatsappStatus: 'pending' | 'sent' | 'failed' | 'not_requested';
  readAt?: string;
  updatedAt: string;
}

interface CommunicationTemplate {
  id: string;
  tenantId: string;
  title: string;
  subject: string;
  body: string;
  category: 'general' | 'academic' | 'billing' | 'emergency' | 'event';
  createdAt: string;
}

interface DeliveryReport {
  message: CommunicationMessage;
  stats: {
    totalRecipients: number;
    readCount: number;
    unreadCount: number;
    readRate: number;
    email: { sent: number; failed: number; successRate: number };
    whatsapp: { sent: number; failed: number; successRate: number };
  };
  recipientsList: CommunicationRecipient[];
}

export default function CommsHubPage() {
  const { user, tenant, token } = useAuthStore();
  
  // Tabs: 'inbox' (Recibidos), 'outbox' (Enviados), 'compose' (Redactar)
  const [activeTab, setActiveTab] = useState<'inbox' | 'outbox' | 'compose'>('inbox');

  // Listados principales
  const [receivedMessages, setReceivedMessages] = useState<CommunicationMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<CommunicationMessage[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [recipientsSearchList, setRecipientsSearchList] = useState<{ id: string; name: string; role: string }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Visores Modales
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMessage | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<DeliveryReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Campos de Redactor (Composer)
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'general' | 'academic' | 'billing' | 'emergency' | 'event'>('general');
  const [targetGroup, setTargetGroup] = useState<'all' | 'teachers' | 'parents' | 'students' | 'grade' | 'individual'>('all');
  const [targetGrade, setTargetGrade] = useState('Secundaria 1°');
  const [individualRecipientId, setIndividualRecipientId] = useState('');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [deliveryChannels, setDeliveryChannels] = useState<('in_app' | 'email' | 'whatsapp')[]>(['in_app', 'email']);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Buscador de reporte de entregas
  const [recipientFilterQuery, setRecipientFilterQuery] = useState('');

  // Cargar datos
  const fetchReceived = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/comms/received`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setReceivedMessages(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSent = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/comms/sent`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSentMessages(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${getApiUrl()}/comms/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cargar destinatarios del sistema para la búsqueda individual
  const fetchRecipientsSearchList = async () => {
    if (!token || !tenant) return;
    try {
      // Cargamos estudiantes
      const resSt = await fetch(`${getApiUrl()}/tenants/${tenant.id}/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataSt = await resSt.json();
      
      const stItems = resSt.ok ? dataSt.map((s: any) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName} (Alumno)`,
        role: 'student'
      })) : [];

      // En SincroEdu, los profesores o admins se cargan desde los usuarios o facultad.
      // Para simplificar, inyectamos una lista combinada estática/dinámica
      const userItems = [
        { id: 'u-prof1', name: 'Alejandro Mendoza (Profesor de Ciencias)', role: 'teacher' },
        { id: 'u-prof2', name: 'Valeria Campos (Tutor de Primaria)', role: 'teacher' },
        { id: 'u-auxiliar1', name: 'Mariana Rosas (Apoyo Administrativo)', role: 'admin' }
      ];

      setRecipientsSearchList([...stItems, ...userItems]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReceived();
      fetchSent();
      fetchTemplates();
      fetchRecipientsSearchList();
    }
  }, [token, tenant]);

  // Al cambiar de tab, recargar la bandeja correspondiente
  useEffect(() => {
    if (token) {
      if (activeTab === 'inbox') fetchReceived();
      if (activeTab === 'outbox') fetchSent();
    }
  }, [activeTab]);

  // Abrir Comunicado Recibido y marcar como LEÍDO en vivo
  const handleOpenMessage = async (msg: CommunicationMessage) => {
    setSelectedMessage(msg);
    if (msg.inAppStatus === 'unread' && token) {
      try {
        const res = await fetch(`${getApiUrl()}/comms/messages/${msg.id}/read`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          // Actualizar estado unread en local inmediatamente
          setReceivedMessages(prev => prev.map(m => m.id === msg.id ? { ...m, inAppStatus: 'read' } : m));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Abrir Reporte de Entrega (Bandeja de Enviados)
  const handleOpenDeliveryReport = async (msg: CommunicationMessage) => {
    if (!token) return;
    setLoadingReport(true);
    setRecipientFilterQuery('');
    try {
      const res = await fetch(`${getApiUrl()}/comms/messages/${msg.id}/delivery`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDeliveryReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  // Aplicar formato de plantilla seleccionada
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setSubject('');
      setBody('');
      return;
    }
    const t = templates.find(temp => temp.id === templateId);
    if (t) {
      // Reemplazos de placeholders demostrativos
      let bodyText = t.body;
      bodyText = bodyText.replace('[Mes]', 'Junio');
      bodyText = bodyText.replace('[Fecha Vencimiento]', '30/06/2026');
      bodyText = bodyText.replace('[Fecha]', '30 de Mayo');
      bodyText = bodyText.replace('[Hora]', '09:00 AM');
      bodyText = bodyText.replace('[Nivel]', 'Secundaria');

      setSubject(t.subject.replace('[Mes]', 'Junio').replace('[Grado/Nivel]', 'Secundaria 1°'));
      setBody(bodyText);
      setCategory(t.category);
    }
  };

  // Toggle canal de envío
  const handleToggleChannel = (channel: 'in_app' | 'email' | 'whatsapp') => {
    if (deliveryChannels.includes(channel)) {
      if (deliveryChannels.length === 1) return; // Requiere al menos un canal
      setDeliveryChannels(prev => prev.filter(c => c !== channel));
    } else {
      setDeliveryChannels(prev => [...prev, channel]);
    }
  };

  // Enviar Comunicado Masivo
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !subject.trim() || !body.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`${getApiUrl()}/comms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject,
          body,
          category,
          targetGroup,
          targetGrade,
          recipientId: targetGroup === 'individual' ? individualRecipientId : undefined,
          attachmentUrl: attachmentTitle || undefined,
          deliveryChannels
        })
      });

      if (res.ok) {
        setSubject('');
        setBody('');
        setAttachmentTitle('');
        setSelectedTemplateId('');
        setActiveTab('outbox');
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // Categorías traducidas
  const renderCategoryBadge = (cat: CommunicationMessage['category']) => {
    const map = {
      general: { name: 'Boletín Informativo', color: 'bg-blue-50 text-blue-700 border-blue-100' },
      academic: { name: 'Circular Académica', color: 'bg-purple-50 text-purple-700 border-purple-100' },
      billing: { name: 'Cobranza / Mensualidad', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
      emergency: { name: 'Alerta / Emergencia', color: 'bg-red-50 text-red-700 border-red-100 font-extrabold animate-pulse' },
      event: { name: 'Evento / Convocatoria', color: 'bg-amber-50 text-amber-700 border-amber-100' }
    };
    const info = map[cat] || { name: cat, color: 'bg-slate-50 text-slate-700 border-slate-100' };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.color}`}>
        {info.name}
      </span>
    );
  };

  // Roles de destinatarios traducidos
  const translateRole = (role: string) => {
    const map: Record<string, string> = {
      teacher: 'Docente',
      parent: 'Apoderado',
      student: 'Alumno',
      admin: 'Administrativo'
    };
    return map[role] || role;
  };

  // Total unread messages count for quick badge
  const unreadCount = receivedMessages.filter(m => m.inAppStatus === 'unread').length;

  const activeColor = tenant?.primaryColor || '#6B8E4E';

  return (
    <div className="space-y-8 font-sans pb-12">
      
      {/* 1. SECCIÓN DE ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(28,44,53,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <MessageSquare className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C2C35]">Centro de Comunicación</h1>
            <p className="text-xs text-slate-400">Canaliza avisos, circulares y alertas urgentes in-app, correo y WhatsApp con trazabilidad absoluta.</p>
          </div>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 select-none">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inbox' ? 'bg-[#1C2C35] text-white shadow-sm' : 'text-[#1C2C35]/60 hover:text-[#1C2C35]'
            }`}
          >
            Bandeja de Entrada
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block animate-pulse" />
            )}
          </button>

          {(user?.roleId === 'r-superadmin' || user?.roleId === 'r-tenant1-admin' || user?.roleId === 'r-tenant1-professor') && (
            <>
              <button
                onClick={() => setActiveTab('outbox')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'outbox' ? 'bg-[#1C2C35] text-white shadow-sm' : 'text-[#1C2C35]/60 hover:text-[#1C2C35]'
                }`}
              >
                Historial Enviados
              </button>
              <button
                onClick={() => setActiveTab('compose')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'compose' ? 'bg-[#1C2C35] text-white shadow-sm' : 'text-[#1C2C35]/60 hover:text-[#1C2C35]'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                Redactar
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. PANEL DE KPIS DE COMUNICACIONES ENVIADAS (Sólo visible para emisores) */}
      {(activeTab === 'outbox' || activeTab === 'compose') && (
        <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* KPI 1: Boletines Enviados */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Circulares Despachadas</span>
              <span className="text-2xl font-extrabold text-[#1C2C35] block">{sentMessages.length} Enviados</span>
              <span className="text-[9px] text-slate-405 font-bold block mt-0.5">Historial Curricular</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Send className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 2: Lectura Promedio */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Índice Promedio Lectura</span>
              <span className="text-2xl font-extrabold text-[#1C2C35] block">82.4%</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                Compromiso Familiar
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 3: WhatsApp Delivery Score */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WhatsApp Delivery</span>
              <span className="text-2xl font-extrabold text-[#1C2C35] block">98.2%</span>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5">API Móvil Conectada</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Phone className="w-5 h-5" />
            </div>
          </div>

          {/* KPI 4: Email Deliverability Score */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:scale-[1.01] transition-transform">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Deliverability</span>
              <span className="text-2xl font-extrabold text-[#1C2C35] block">96.4%</span>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Spam Score Favorable</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </section>
      )}

      {/* 3. CONTENIDO PRINCIPAL SEGÚN TABS */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 md:p-8">
        
        {/* TAB 1: BANDEJA DE ENTRADA (RECIBIDOS) */}
        {activeTab === 'inbox' && (
          <div className="space-y-5">
            <h2 className="text-xs font-black text-[#1C2C35]/85 uppercase tracking-wider flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              Circular Informativa e In-App Inbox
            </h2>

            {loading ? (
              <div className="py-20 text-center text-xs text-slate-450 font-bold flex flex-col items-center justify-center gap-2">
                <Clock className="w-8 h-8 animate-spin text-[#6B8E4E]" />
                Sincronizando buzón...
              </div>
            ) : receivedMessages.length === 0 ? (
              <div className="py-24 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                <MessageSquare className="w-10 h-10 text-slate-200" />
                <p className="text-xs">Buzón vacío. No hay comunicados dirigidos a ti en este periodo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 select-none">
                {receivedMessages.map((msg) => {
                  const isUnread = msg.inAppStatus === 'unread';
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleOpenMessage(msg)}
                      className={`p-5 rounded-2xl border text-xs font-semibold cursor-pointer transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden ${
                        isUnread 
                          ? 'bg-amber-50/20 border-amber-200 shadow-sm hover:border-amber-300' 
                          : 'bg-white border-slate-100 hover:border-slate-350 hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Unread amber glow banner */}
                      {isUnread && (
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
                      )}

                      <div className="space-y-1.5 flex-1 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderCategoryBadge(msg.category)}
                          <span className="text-[10px] text-slate-400 font-bold">
                            De: <strong>{msg.senderName} ({msg.senderRole})</strong>
                          </span>
                        </div>
                        <h3 className="text-xs md:text-sm font-black text-[#1C2C35] leading-tight">
                          {msg.subject}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium truncate max-w-2xl leading-relaxed">
                          {msg.body}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        {msg.attachmentUrl && (
                          <span className="p-1.5 bg-slate-100 rounded-lg text-slate-450 border border-slate-200 block" title="Contiene Archivo Adjunto">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                        )}

                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                          {new Date(msg.createdAt).toLocaleDateString('es-ES')} - {new Date(msg.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HISTORIAL ENVIADOS (OUTBOX) */}
        {activeTab === 'outbox' && (
          <div className="space-y-5">
            <h2 className="text-xs font-black text-[#1C2C35]/85 uppercase tracking-wider">
              Historial de Boletines y Notificaciones Despachadas
            </h2>

            {loading ? (
              <div className="py-20 text-center text-xs text-slate-450 font-bold flex flex-col items-center justify-center gap-2">
                <Clock className="w-8 h-8 animate-spin text-[#6B8E4E]" />
                Obteniendo despachos...
              </div>
            ) : sentMessages.length === 0 ? (
              <div className="py-24 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                <Send className="w-10 h-10 text-slate-200" />
                <p className="text-xs">No has enviado ningún comunicado en este tenant escolar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => handleOpenDeliveryReport(msg)}
                    className="p-5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 bg-white transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 pr-4">
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-bold">
                        {renderCategoryBadge(msg.category)}
                        <span>Para: <strong className="uppercase">{msg.targetGroup}</strong></span>
                        {msg.targetGrade && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px]">{msg.targetGrade}</span>}
                      </div>

                      <h3 className="text-xs md:text-sm font-black text-[#1C2C35] leading-tight">
                        {msg.subject}
                      </h3>
                      
                      {/* Micro analíticas rápidas en tarjeta */}
                      {msg.analytics && (
                        <div className="flex items-center gap-3.5 pt-1.5">
                          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Auditoría: {msg.analytics.totalRecipients}
                          </span>
                          <span className="text-[10px] text-green-600 font-extrabold flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                            Lectura: {msg.analytics.readRate}%
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            Vías: {msg.deliveryChannels.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-3 self-end sm:self-center">
                      <button
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#1C2C35] font-extrabold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-[#1C2C35]" />
                        Auditar Entrega
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REDACTAR COMUNICADO (COMPOSER) */}
        {activeTab === 'compose' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-black text-[#1C2C35]">Componer Comunicado Oficial</h2>
              <p className="text-xs text-slate-400 mt-0.5">Diseña avisos y lánzalos de manera coordinada por múltiples canales corporativos.</p>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-5">
              
              {/* Plantillas oficiales y Categoría */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                    Utilizar Plantilla Institucional (Autocompletar)
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={e => handleSelectTemplate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold bg-slate-50 cursor-pointer"
                  >
                    <option value="">-- Redactar en blanco --</option>
                    {templates.map(tmpl => (
                      <option key={tmpl.id} value={tmpl.id}>{tmpl.title} ({tmpl.category})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                    Categoría / Tipo de Circular
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold bg-slate-50 cursor-pointer"
                  >
                    <option value="general">Boletín Informativo</option>
                    <option value="academic">Circular Académica</option>
                    <option value="billing">Cobranza / Pago</option>
                    <option value="emergency">Alerta / Emergencia</option>
                    <option value="event">Evento / Convocatoria</option>
                  </select>
                </div>
              </div>

              {/* Segmentación de Destinatarios */}
              <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center gap-1 border-b border-slate-100 pb-1.5">
                  <Users className="w-4 h-4 text-[#6B8E4E]" />
                  <h4 className="text-[10px] font-black text-[#1C2C35]/70 uppercase tracking-wider">
                    Segmentación y Grupo de Destino
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Grupo Destinatario</label>
                    <select
                      value={targetGroup}
                      onChange={e => {
                        setTargetGroup(e.target.value as any);
                        setIndividualRecipientId('');
                      }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold bg-white cursor-pointer"
                    >
                      <option value="all">Toda la Escuela (Matrícula y Docentes)</option>
                      <option value="teachers">Sólo Profesores / Personal docente</option>
                      <option value="parents">Sólo Padres de Familia y Apoderados</option>
                      <option value="students">Sólo Alumnos Registrados</option>
                      <option value="grade">Grado Escolar Específico</option>
                      <option value="individual">Destinatario Individual (1 a 1)</option>
                    </select>
                  </div>

                  {/* Dinámico: Selector de grado */}
                  {targetGroup === 'grade' && (
                    <div className="space-y-1 animate-scale-up">
                      <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Grado Específico</label>
                      <select
                        value={targetGrade}
                        onChange={e => setTargetGrade(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold bg-white cursor-pointer"
                      >
                        <option value="Primaria 1°">Primaria 1°</option>
                        <option value="Primaria 3°">Primaria 3°</option>
                        <option value="Primaria 5°">Primaria 5°</option>
                        <option value="Secundaria 1°">Secundaria 1°</option>
                        <option value="Secundaria 3°">Secundaria 3°</option>
                        <option value="Secundaria 5°">Secundaria 5°</option>
                      </select>
                    </div>
                  )}

                  {/* Dinámico: Autocomplete individual */}
                  {targetGroup === 'individual' && (
                    <div className="space-y-1 animate-scale-up md:col-span-2">
                      <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Buscar Destinatario</label>
                      <SelectSearch
                        options={recipientsSearchList.map(r => ({ value: r.id, label: r.name }))}
                        placeholder="Escribe el nombre del alumno, docente o apoderado..."
                        value={individualRecipientId}
                        onChange={setIndividualRecipientId}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Contenido: Asunto y Cuerpo */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Asunto del Comunicado</label>
                  <input
                    type="text" required placeholder="Redacte el título de la circular..." value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-semibold text-slate-800 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Mensaje / Cuerpo de la Circular</label>
                  <textarea
                    rows={8} required placeholder="Redacte el boletín oficial detalladamente..." value={body}
                    onChange={e => setBody(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-[#1C2C35] focus:outline-none focus:border-[#6B8E4E] font-medium text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Integración Omnicanal (Checklist) y Adjunto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Omnicanal triggers */}
                <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100 space-y-3">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
                    Activar Canales de Despacho Corporativos
                  </label>
                  
                  <div className="space-y-2">
                    {/* In-App */}
                    <div 
                      onClick={() => handleToggleChannel('in_app')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                        deliveryChannels.includes('in_app')
                          ? 'border-[#6B8E4E] bg-[#6B8E4E]/5 text-[#6B8E4E]'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        🗂️ Buzón y Mensajería Interna (In-App)
                      </span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        deliveryChannels.includes('in_app') ? 'bg-[#6B8E4E] border-transparent text-white' : 'border-slate-300'
                      }`}>
                        {deliveryChannels.includes('in_app') && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    {/* Email */}
                    <div 
                      onClick={() => handleToggleChannel('email')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                        deliveryChannels.includes('email')
                          ? 'border-blue-500 bg-blue-50/20 text-blue-600'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        ✉️ Correo Electrónico (Boletín e Circular PDF)
                      </span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        deliveryChannels.includes('email') ? 'bg-blue-500 border-transparent text-white' : 'border-slate-300'
                      }`}>
                        {deliveryChannels.includes('email') && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    {/* WhatsApp */}
                    <div 
                      onClick={() => handleToggleChannel('whatsapp')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                        deliveryChannels.includes('whatsapp')
                          ? 'border-emerald-500 bg-emerald-50/20 text-emerald-600'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        💬 Alerta Móvil SMS / WhatsApp (Prioritario)
                      </span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        deliveryChannels.includes('whatsapp') ? 'bg-emerald-500 border-transparent text-white' : 'border-slate-300'
                      }`}>
                        {deliveryChannels.includes('whatsapp') && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adjunto */}
                <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Cargar Archivo Adjunto (Circular PDF)</label>
                    <p className="text-[10px] text-slate-400">Anexa el documento de aforos, calendarios o reglamentos en formato PDF escolar.</p>
                  </div>

                  <div className="space-y-3 pt-3">
                    <input
                      type="text" placeholder="ej: Circular_Reglamento_Ingreso_2026.pdf" value={attachmentTitle}
                      onChange={e => setAttachmentTitle(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E]"
                    />
                    
                    <div className="p-3 border-2 border-dashed border-slate-200 rounded-xl text-center text-[10px] text-slate-400 font-bold bg-white/40 cursor-pointer hover:bg-slate-55 hover:border-slate-300 transition-colors">
                      Arrastra tu circular PDF aquí o escribe el nombre arriba
                    </div>
                  </div>
                </div>

              </div>

              {/* Botón de Envío */}
              <div className="flex justify-end pt-3 gap-3">
                <button
                  type="button" onClick={() => setActiveTab('inbox')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit" disabled={sending}
                  className="px-6 py-2.5 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] shadow-md transition-transform cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  style={{ backgroundColor: activeColor }}
                >
                  {sending ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Despachando Canales...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Lanzar Comunicado Masivo
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

      </section>

      {/* 4. MODAL: VISOR DE COMUNICADO RECIBIDO (IN-APP VISOR) */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up relative">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {renderCategoryBadge(selectedMessage.category)}
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-full uppercase">
                    Recibido In-App
                  </span>
                </div>
                <h3 className="text-sm md:text-base font-black text-[#1C2C35] leading-snug mt-1">
                  {selectedMessage.subject}
                </h3>
              </div>
              
              <button 
                onClick={() => setSelectedMessage(null)}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer shrink-0 ml-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 text-xs md:text-sm text-[#1C2C35]/80 leading-relaxed max-h-[350px] overflow-y-auto font-medium">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 text-[10px] text-slate-405 font-bold mb-2">
                <span>Remitente: <strong>{selectedMessage.senderName} ({selectedMessage.senderRole})</strong></span>
                <span>{new Date(selectedMessage.createdAt).toLocaleDateString('es-ES')} - {new Date(selectedMessage.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Split paragraph render */}
              {selectedMessage.body.split('\n').map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>

            {/* Document download triggers */}
            {selectedMessage.attachmentUrl && (
              <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150 flex items-center justify-between gap-4 mt-6">
                <div className="flex items-center gap-2.5 text-xs font-bold text-[#1C2C35]">
                  <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="block truncate max-w-[280px] font-black">{selectedMessage.attachmentUrl}</span>
                    <span className="text-[9px] text-slate-400 block font-semibold">Documento Oficial PDF • Ficticio</span>
                  </div>
                </div>

                <a 
                  href="#" onClick={e => { e.preventDefault(); alert(`Simulación: Descargando ${selectedMessage.attachmentUrl}`); }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Descargar
                </a>
              </div>
            )}

            {/* Footer close button */}
            <div className="pt-5 mt-4 border-t border-slate-100 flex justify-end text-xs font-bold">
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. MODAL: REPORTE DE ANALÍTICA DE ENTREGA (DELIVERY ANALYTICS REPORT) */}
      {deliveryReport && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="w-full max-w-3xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-scale-up max-h-[90vh] flex flex-col justify-between relative overflow-hidden">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4 sticky top-0 bg-white">
              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded-full uppercase">
                    Auditoría de Canales
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    ID Comunicado: <code className="bg-slate-100 px-1 py-0.5 rounded text-[9px]">{deliveryReport.message.id}</code>
                  </span>
                </div>
                <h3 className="text-xs md:text-sm font-black text-[#1C2C35] leading-snug">
                  Auditoría: {deliveryReport.message.subject}
                </h3>
              </div>
              
              <button 
                onClick={() => setDeliveryReport(null)}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              
              {/* Report KPIs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                
                {/* Total */}
                <div className="space-y-0.5 text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Destinatarios</span>
                  <span className="text-lg font-extrabold text-[#1C2C35]">{deliveryReport.stats.totalRecipients}</span>
                </div>

                {/* Read Rate */}
                <div className="space-y-0.5 text-center border-l border-slate-200">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Leídos In-App</span>
                  <span className="text-lg font-extrabold text-green-600">{deliveryReport.stats.readRate}%</span>
                </div>

                {/* Email rate */}
                <div className="space-y-0.5 text-center border-l border-slate-200">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">WhatsApp Delivery</span>
                  <span className="text-lg font-extrabold text-[#6B8E4E]">{deliveryReport.stats.whatsapp.successRate}%</span>
                </div>

                {/* Email success */}
                <div className="space-y-0.5 text-center border-l border-slate-200">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Email Delivery</span>
                  <span className="text-lg font-extrabold text-blue-500">{deliveryReport.stats.email.successRate}%</span>
                </div>

              </div>

              {/* Recipients detailed grid */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h4 className="text-[10px] font-black text-[#1C2C35]/70 uppercase tracking-wider">
                    Desglose de Destinatarios de la Circular
                  </h4>
                  
                  {/* Buscador interno */}
                  <div className="relative w-full sm:w-60" onClick={e => e.stopPropagation()}>
                    <input 
                      type="text" placeholder="Buscar destinatario..." value={recipientFilterQuery}
                      onChange={e => setRecipientFilterQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#6B8E4E]"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Table list */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/20 max-h-[250px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-[#1C2C35]/80 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Destinatario</th>
                        <th className="py-2.5 px-3">Rol</th>
                        <th className="py-2.5 px-3 text-center">Buzón Interno</th>
                        <th className="py-2.5 px-3 text-center">Correo E.</th>
                        <th className="py-2.5 px-3 text-center">WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[#1C2C35]/80 bg-white font-medium">
                      {deliveryReport.recipientsList
                        .filter(r => r.recipientName.toLowerCase().includes(recipientFilterQuery.toLowerCase()))
                        .map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-extrabold text-[#1C2C35]">
                              {rec.recipientName}
                            </td>
                            <td className="py-2 px-3 text-[10px] text-slate-405 font-bold">
                              {translateRole(rec.recipientRole)}
                            </td>
                            {/* In-app */}
                            <td className="py-2 px-3 text-center">
                              {rec.inAppStatus === 'read' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] text-green-600 font-extrabold bg-green-50 px-1.5 py-0.5 rounded">
                                  <Check className="w-2.5 h-2.5 shrink-0" /> Leído
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] text-slate-450 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                  No Leído
                                </span>
                              )}
                            </td>
                            {/* Email */}
                            <td className="py-2 px-3 text-center">
                              {rec.emailStatus === 'sent' ? (
                                <span className="text-[9px] text-blue-500 font-black bg-blue-50 px-1.5 py-0.5 rounded">
                                  Enviado
                                </span>
                              ) : rec.emailStatus === 'failed' ? (
                                <span className="text-[9px] text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded">
                                  Rebotó
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-350 font-bold">
                                  -
                                </span>
                              )}
                            </td>
                            {/* WhatsApp */}
                            <td className="py-2 px-3 text-center">
                              {rec.whatsappStatus === 'sent' ? (
                                <span className="text-[9px] text-emerald-600 font-black bg-emerald-50 px-1.5 py-0.5 rounded">
                                  Entregado
                                </span>
                              ) : rec.whatsappStatus === 'failed' ? (
                                <span className="text-[9px] text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded">
                                  Falla N.
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-350 font-bold">
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-500 leading-relaxed font-semibold">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Canales de Despacho:</strong> El reporte muestra el estado simulado de envío en lote procesado de forma asíncrona sobre los servidores de correo y telefonía.
                  </span>
                </div>
              </div>

            </div>

            {/* Footer close */}
            <div className="pt-4 border-t border-slate-100 flex justify-end text-xs font-bold sticky bottom-0 bg-white">
              <button
                onClick={() => setDeliveryReport(null)}
                className="px-4 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer"
              >
                Cerrar Auditoría
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
