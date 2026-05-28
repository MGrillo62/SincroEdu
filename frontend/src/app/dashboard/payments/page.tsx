'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiUrl } from '@/lib/config';
import { 
  CreditCard, DollarSign, FileText, CheckCircle2, AlertTriangle, XCircle, 
  Calendar, User, Plus, RefreshCw, BarChart3, TrendingUp, Layers, BookOpen, 
  Users, Award, Settings, ShieldAlert, ArrowUpRight, ArrowDownRight, Printer, 
  Download, Clock, Check, Sparkles, Building, Lock, FileSpreadsheet, Eye
} from 'lucide-react';

const API_URL = getApiUrl();

export default function PaymentsPage() {
  const { token, user, tenant } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'profitability' | 'receivables' | 'payables' | 'ledger'>('overview');
  
  // States for Admin
  const [adminData, setAdminData] = useState<any>(null);
  const [profitabilityData, setProfitabilityData] = useState<any>(null);
  const [profitDimension, setProfitDimension] = useState<'course' | 'period' | 'month' | 'year'>('course');
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerStatus, setLedgerStatus] = useState<any>(null);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  
  // States for Parent
  const [parentData, setParentData] = useState<any>(null);
  
  // States for Professor
  const [professorData, setProfessorData] = useState<any>(null);

  // Modal and Interactive States
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);
  
  const [isInvoiceGenerating, setIsInvoiceGenerating] = useState<string | null>(null);
  const [generatedInvoiceData, setGeneratedInvoiceData] = useState<any>(null);

  // Admin New Receivable/Payable Modals
  const [isNewRecModalOpen, setIsNewRecModalOpen] = useState(false);
  const [newRecData, setNewRecData] = useState({ studentId: 'st-1', concept: '', amount: '', dueDate: '' });
  
  const [isNewPayModalOpen, setIsNewPayModalOpen] = useState(false);
  const [newPayData, setNewPayData] = useState({ professorId: 'p-1', concept: '', amount: '', dueDate: '' });

  // Payroll modal state
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [selectedProfId, setSelectedProfId] = useState('p-1');
  const [payrollPeriod, setPayrollPeriod] = useState('2026-05');
  const [calculatedPayroll, setCalculatedPayroll] = useState<any>(null);
  const [isPayrollProcessing, setIsPayrollProcessing] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token, user?.roleId, profitDimension]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      if (user?.roleId === 'r-superadmin' || user?.roleId === 'r-tenant1-admin') {
        // Fetch Admin Consolidated Finance Dashboard
        const adminRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/dashboard/admin`, { headers });
        const adminDataJson = await adminRes.json();
        setAdminData(adminDataJson);

        // Fetch Profitability Data based on selected dimension
        const profitRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/profitability?dimension=${profitDimension}`, { headers });
        setProfitabilityData(await profitRes.json());

        // Fetch Receivables & Payables lists
        const recsRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/receivables`, { headers });
        setReceivables(await recsRes.json());

        const paysRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/payables`, { headers });
        setPayables(await paysRes.json());

        // Fetch Ledger
        const ledgerRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/ledger`, { headers });
        setLedgerEntries(await ledgerRes.json());

        // Fetch Ledger Status
        const verifyRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/ledger/verify`, { headers });
        setLedgerStatus(await verifyRes.json());
      } 
      
      else if (user?.roleId === 'r-tenant1-parent') {
        // Fetch Parent Dashboard
        const parentRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/dashboard/parent`, { headers });
        setParentData(await parentRes.json());
      } 
      
      else if (user?.roleId === 'r-tenant1-professor') {
        // Fetch Professor Dashboard
        const profRes = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/dashboard/professor`, { headers });
        setProfessorData(await profRes.json());
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al sincronizar con los servicios financieros del servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Simulación de Pago de Recibo (Stripe Gate Simulator)
  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;
    setIsPaying(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receivableId: selectedReceivable.id,
          amount: Number(selectedReceivable.amount - selectedReceivable.paid_amount),
          paymentMethod: 'STRIPE',
          gatewayReference: `ch_stripe_${Math.random().toString(36).substring(2, 15)}`,
          metadata: { card_brand: 'Visa', last4: '4242' }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fallo en la pasarela de pagos.');

      setPaymentSuccessData(data);
      setIsPayModalOpen(false);
      // Actualizar datos
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPaying(false);
    }
  };

  // 2. Simular Integración de Facturación Electrónica con NubeFacT
  const handleGenerateInvoice = async (transactionId: string) => {
    setIsInvoiceGenerating(transactionId);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/transactions/${transactionId}/invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al emitir comprobante tributario.');

      setGeneratedInvoiceData(data);
      // Refresh
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsInvoiceGenerating(null);
    }
  };

  // 3. Crear Cuenta por Cobrar Manual
  const handleCreateReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/receivables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: newRecData.studentId,
          concept: newRecData.concept,
          amount: Number(newRecData.amount),
          dueDate: newRecData.dueDate
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al registrar.');
      }

      setIsNewRecModalOpen(false);
      setNewRecData({ studentId: 'st-1', concept: '', amount: '', dueDate: '' });
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 4. Crear Cuenta por Pagar Manual
  const handleCreatePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/payables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          professorId: newPayData.professorId,
          concept: newPayData.concept,
          amount: Number(newPayData.amount),
          dueDate: newPayData.dueDate
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al registrar.');
      }

      setIsNewPayModalOpen(false);
      setNewPayData({ professorId: 'p-1', concept: '', amount: '', dueDate: '' });
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 5. Pre-calcular Nómina Docente basada en Asistencia
  const handleCalculatePayroll = async () => {
    setError(null);
    setCalculatedPayroll(null);
    try {
      const res = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/payroll/calculate?professorId=${selectedProfId}&yearMonth=${payrollPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de cálculo.');
      setCalculatedPayroll(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 6. Confirmar y Registrar Nómina contable
  const handleProcessPayroll = async () => {
    if (!calculatedPayroll) return;
    setIsPayrollProcessing(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/tenants/${tenant?.id}/billing/payroll/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          professorId: selectedProfId,
          yearMonth: payrollPeriod
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al procesar.');

      alert(`✅ Nómina procesada exitosamente. Se emitió un Cuenta por Pagar ID ${data.payableId} por un valor de S/ ${data.netPayroll.toFixed(2)}`);
      setIsPayrollModalOpen(false);
      setCalculatedPayroll(null);
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPayrollProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-emerald-400">
        <RefreshCw className="animate-spin w-10 h-10 mb-4" />
        <p className="text-gray-400 text-sm font-medium">Sincronizando balances contables y flujos de caja...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      
      {/* HEADER DE BIENVENIDA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <span className="bg-emerald-950 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider border border-emerald-900">
            {user?.roleName}
          </span>
          <h1 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
            Ecosistema de Cobros, Pagos y Rentabilidad 
            <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {tenant?.name} • Moneda: {tenant?.id === 'bb820465-b778-43d9-a723-f390035cb3c8' ? 'MXN ($)' : 'PEN (S/)'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recargar Balances
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-950/40 text-rose-300 border border-rose-900/50 rounded-xl">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* 1. VISTA DE ADMINISTRADOR FINANCIERO (SUPERADMIN / ADMIN) */}
      {/* ========================================================================================= */}
      {(user?.roleId === 'r-superadmin' || user?.roleId === 'r-tenant1-admin') && adminData && (
        <div className="space-y-6">
          
          {/* TARJETAS DE KPIs PREMIUM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* KPI 1: Caja y Bancos */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 p-5 rounded-2xl border border-slate-800/80 shadow-md">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Building className="w-5 h-5" />
                </div>
                <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full font-medium">Caja Contable</span>
              </div>
              <div className="mt-4">
                <div className="text-slate-400 text-xs font-medium">Efectivo en Caja / Bancos</div>
                <div className="text-2xl font-bold text-white mt-1">
                  S/ {adminData.metrics.cashBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* KPI 2: Cuentas por Cobrar (AR) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 p-5 rounded-2xl border border-slate-800/80 shadow-md">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-medium">AR (Deudores)</span>
              </div>
              <div className="mt-4">
                <div className="text-slate-400 text-xs font-medium">Pensiones por Cobrar</div>
                <div className="text-2xl font-bold text-white mt-1">
                  S/ {adminData.metrics.arOutstanding.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-rose-400 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> S/ {adminData.metrics.arOverdue.toLocaleString('es-PE', { minimumFractionDigits: 2 })} Vencido
                </div>
              </div>
            </div>

            {/* KPI 3: Cuentas por Pagar (AP) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20 p-5 rounded-2xl border border-slate-800/80 shadow-md">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <span className="text-[10px] bg-slate-800 text-rose-400 px-2 py-0.5 rounded-full font-medium">AP (Nómina)</span>
              </div>
              <div className="mt-4">
                <div className="text-slate-400 text-xs font-medium">Obligaciones de Nómina Docente</div>
                <div className="text-2xl font-bold text-white mt-1">
                  S/ {adminData.metrics.apOutstanding.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* KPI 4: Utilidad Operativa */}
            <div className="bg-gradient-to-br from-slate-900 via-emerald-950/10 to-slate-900 p-5 rounded-2xl border border-emerald-900/30 shadow-md">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full font-bold">Operativa</span>
              </div>
              <div className="mt-4">
                <div className="text-slate-400 text-xs font-medium">Utilidad Operativa Neta</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  S/ {adminData.metrics.operationalProfit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* MENÚ DE TABS FINANCIEROS */}
          <div className="flex border-b border-slate-800">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-3 text-sm font-semibold transition ${activeTab === 'overview' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Caja y Resumen
            </button>
            <button 
              onClick={() => setActiveTab('profitability')}
              className={`px-5 py-3 text-sm font-semibold transition ${activeTab === 'profitability' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Motor de Rentabilidad
            </button>
            <button 
              onClick={() => setActiveTab('receivables')}
              className={`px-5 py-3 text-sm font-semibold transition ${activeTab === 'receivables' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Cuentas por Cobrar
            </button>
            <button 
              onClick={() => setActiveTab('payables')}
              className={`px-5 py-3 text-sm font-semibold transition ${activeTab === 'payables' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Cuentas por Pagar / Nómina
            </button>
            <button 
              onClick={() => setActiveTab('ledger')}
              className={`px-5 py-3 text-sm font-semibold transition ${activeTab === 'ledger' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Libro Mayor (Ledger)
            </button>
          </div>

          {/* CONTENIDOS DE TABS */}
          {/* TAB 1: OVERVIEW & CASH FLOW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico/Distribución de Cuentas Contables del Libro Mayor */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Saldos de Cuentas Contables (Balanza de Comprobación)
                </h3>
                <p className="text-xs text-slate-400">
                  Valores deducidos en tiempo real cruzando todas las partidas de diario asentadas en el Ledger.
                </p>
                
                <div className="space-y-3 mt-4">
                  {adminData.ledgerAccounts.map((acc: any) => {
                    const absVal = Math.abs(acc.balance);
                    const percent = Math.min(100, Math.max(8, (absVal / (adminData.metrics.totalIncome || 1000)) * 100));
                    return (
                      <div key={acc.accountId} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-300">{acc.accountId} - {acc.accountName}</span>
                          <span className={`${acc.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            S/ {acc.balance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${percent}%` }}
                            className={`h-full rounded-full ${
                              acc.accountType === 'ASSET' ? 'bg-emerald-500' :
                              acc.accountType === 'LIABILITY' ? 'bg-amber-500' :
                              acc.accountType === 'REVENUE' ? 'bg-teal-500' : 'bg-rose-500'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Acciones de Flujo Rápido (Crear Recibo, Nómina, etc.) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <h3 className="text-lg font-bold text-white">Consola de Operaciones</h3>
                
                <div className="space-y-3">
                  <button 
                    onClick={() => setIsNewRecModalOpen(true)}
                    className="w-full flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-left text-sm font-semibold transition"
                  >
                    <Plus className="w-5 h-5 flex-shrink-0" />
                    Emitir Cuenta por Cobrar (AR)
                  </button>

                  <button 
                    onClick={() => setIsNewPayModalOpen(true)}
                    className="w-full flex items-center gap-3 p-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-left text-sm font-semibold transition"
                  >
                    <Plus className="w-5 h-5 flex-shrink-0" />
                    Registrar Cuenta por Pagar (AP)
                  </button>

                  <button 
                    onClick={() => setIsPayrollModalOpen(true)}
                    className="w-full flex items-center gap-3 p-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 rounded-xl text-left text-sm font-semibold transition"
                  >
                    <Clock className="w-5 h-5 flex-shrink-0" />
                    Procesar Nómina Docente (Asistencia)
                  </button>
                </div>

                <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-900/30 text-xs text-slate-400 space-y-2">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Garantía Transaccional ACID
                  </div>
                  <p>
                    Cualquier operación realizada en este panel ejecuta de forma atómica su debida asiento en el Libro Mayor General, impidiendo inconsistencias contables o dobles cobros.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MOTOR DE RENTABILIDAD */}
          {activeTab === 'profitability' && profitabilityData && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    Análisis de Rentabilidad Operativa Multidimensional
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cruce en tiempo real de ingresos por mensualidades con costos operativos de nóminas docentes.
                  </p>
                </div>

                {/* Filtro de Dimensión */}
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <button 
                    onClick={() => setProfitDimension('course')}
                    className={`px-3 py-1 text-xs font-semibold rounded ${profitDimension === 'course' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400'}`}
                  >
                    Por Curso
                  </button>
                  <button 
                    onClick={() => setProfitDimension('month')}
                    className={`px-3 py-1 text-xs font-semibold rounded ${profitDimension === 'month' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400'}`}
                  >
                    Por Mes
                  </button>
                  <button 
                    onClick={() => setProfitDimension('period')}
                    className={`px-3 py-1 text-xs font-semibold rounded ${profitDimension === 'period' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400'}`}
                  >
                    Por Periodo
                  </button>
                  <button 
                    onClick={() => setProfitDimension('year')}
                    className={`px-3 py-1 text-xs font-semibold rounded ${profitDimension === 'year' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400'}`}
                  >
                    Por Año
                  </button>
                </div>
              </div>

              {/* RENDER POR DIMENSIÓN */}
              {profitDimension === 'course' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Código / Curso</th>
                        <th className="py-3 px-4 text-center">Créditos</th>
                        <th className="py-3 px-4 text-right">Ingresos Académicos</th>
                        <th className="py-3 px-4 text-right">Costo Docente (Asistencia)</th>
                        <th className="py-3 px-4 text-right">Utilidad Operativa</th>
                        <th className="py-3 px-4 text-center">Margen Operativo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {profitabilityData.data.map((row: any) => (
                        <tr key={row.course_id} className="hover:bg-slate-800/20 text-slate-300">
                          <td className="py-3 px-4 font-semibold">
                            <span className="text-slate-500 mr-2">[{row.course_code}]</span>
                            {row.course_name}
                          </td>
                          <td className="py-3 px-4 text-center">{row.credits}</td>
                          <td className="py-3 px-4 text-right font-medium text-teal-400">S/ {row.income.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-medium text-amber-500">S/ {row.expense.toFixed(2)}</td>
                          <td className={`py-3 px-4 text-right font-bold ${row.operational_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            S/ {row.operational_profit.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              row.profit_margin >= 50 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 
                              row.profit_margin >= 0 ? 'bg-amber-950 text-amber-400 border border-amber-900' : 
                              'bg-rose-950 text-rose-400 border border-rose-900'
                            }`}>
                              {row.profit_margin}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Periodo Temporal</th>
                        <th className="py-3 px-4 text-right">Ingresos Globales (Ledger)</th>
                        <th className="py-3 px-4 text-right">Egresos de Nómina</th>
                        <th className="py-3 px-4 text-right">Utilidad Operativa</th>
                        <th className="py-3 px-4 text-center">Margen Operativo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {profitabilityData.data.map((row: any) => (
                        <tr key={row.dimensionValue} className="hover:bg-slate-800/20 text-slate-300">
                          <td className="py-3 px-4 font-bold text-slate-200">{row.dimensionValue}</td>
                          <td className="py-3 px-4 text-right text-teal-400 font-semibold">S/ {row.income.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-amber-500 font-semibold">S/ {row.expense.toFixed(2)}</td>
                          <td className={`py-3 px-4 text-right font-bold ${row.operational_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            S/ {row.operational_profit.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold">
                              {row.profit_margin}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RECEIVABLES */}
          {activeTab === 'receivables' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Lista de Cuentas por Cobrar (Alumnos/Padres)</h3>
                <button 
                  onClick={() => setIsNewRecModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Nuevo Cobro
                </button>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Alumno</th>
                      <th className="py-3 px-4">Concepto</th>
                      <th className="py-3 px-4 text-right">Monto Total</th>
                      <th className="py-3 px-4 text-right">Cobrado</th>
                      <th className="py-3 px-4 text-center">Fecha Venc.</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {receivables.map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-slate-800/20 text-slate-300">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {rec.student_first_name} {rec.student_last_name}
                          <div className="text-[10px] text-slate-500 font-normal">{rec.enrollment_number}</div>
                        </td>
                        <td className="py-3 px-4">{rec.concept}</td>
                        <td className="py-3 px-4 text-right font-medium">S/ {Number(rec.amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-medium">S/ {Number(rec.paid_amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-medium text-slate-400">{rec.due_date.substring(0, 10)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            rec.status === 'PAID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                            rec.status === 'OVERDUE' ? 'bg-rose-950 text-rose-400 border border-rose-900' :
                            'bg-amber-950 text-amber-400 border border-amber-900'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYABLES */}
          {activeTab === 'payables' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Lista de Cuentas por Pagar (Docentes/Nómina)</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsPayrollModalOpen(true)}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Clock className="w-3.5 h-3.5" /> Procesar Nómina
                  </button>
                  <button 
                    onClick={() => setIsNewPayModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nuevo Egreso
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Beneficiario / Docente</th>
                      <th className="py-3 px-4">Concepto</th>
                      <th className="py-3 px-4 text-right">Monto Total</th>
                      <th className="py-3 px-4 text-right">Pagado</th>
                      <th className="py-3 px-4 text-center">Fecha Venc.</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {payables.map((pay: any) => (
                      <tr key={pay.id} className="hover:bg-slate-800/20 text-slate-300">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {pay.professor_first_name ? `${pay.professor_first_name} ${pay.professor_last_name}` : 'General / Staff'}
                          {pay.specialty && <div className="text-[10px] text-slate-500 font-normal">{pay.specialty}</div>}
                        </td>
                        <td className="py-3 px-4">{pay.concept}</td>
                        <td className="py-3 px-4 text-right font-medium">S/ {Number(pay.amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-medium">S/ {Number(pay.paid_amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-medium text-slate-400">{pay.due_date.substring(0, 10)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            pay.status === 'PAID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                            pay.status === 'OVERDUE' ? 'bg-rose-950 text-rose-400 border border-rose-900' :
                            'bg-amber-950 text-amber-400 border border-amber-900'
                          }`}>
                            {pay.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: LEDGER */}
          {activeTab === 'ledger' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              
              {/* Ledger integrity header status */}
              {ledgerStatus && (
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                  ledgerStatus.balanced 
                    ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' 
                    : 'bg-rose-950/20 border-rose-900/50 text-rose-400'
                }`}>
                  <div className="flex items-center gap-3">
                    {ledgerStatus.balanced ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Lock className="w-4 h-4 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        Integridad del Libro Mayor: {ledgerStatus.balanced ? 'Equilibrado (Double-Entry Validated)' : 'Inconsistente'}
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Débitos Totales: S/ {ledgerStatus.globalCheck.totalDebits.toFixed(2)} • Créditos Totales: S/ {ledgerStatus.globalCheck.totalCredits.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg font-bold">
                    Diferencia Contable: S/ {ledgerStatus.globalCheck.difference.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Asientos Diarios detallados */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">Partidas y Asientos de Diario Contables</h3>
                
                <div className="space-y-4">
                  {ledgerEntries.map((entry: any) => (
                    <div key={entry.id} className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/40">
                      {/* Cabecera Asiento */}
                      <div className="bg-slate-800/30 p-3.5 border-b border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-200">{entry.description}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{entry.entryDate}</div>
                        </div>
                        {entry.transactionId && (
                          <span className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded font-mono text-[9px]">
                            TX: {entry.transactionId.substring(0, 8)}
                          </span>
                        )}
                      </div>

                      {/* Líneas Debe y Haber */}
                      <table className="w-full text-left border-collapse text-[11px] font-mono">
                        <thead>
                          <tr className="bg-slate-950/20 text-slate-500 border-b border-slate-800/50">
                            <th className="py-1.5 px-4">Código Cuenta</th>
                            <th className="py-1.5 px-4">Nombre Cuenta Contable</th>
                            <th className="py-1.5 px-4 text-right">Debe (Debit)</th>
                            <th className="py-1.5 px-4 text-right">Haber (Credit)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {entry.lines.map((line: any) => (
                            <tr key={line.id} className="hover:bg-slate-800/10 text-slate-400">
                              <td className="py-2 px-4 text-slate-500 font-bold">{line.accountId}</td>
                              <td className="py-2 px-4 text-slate-300">{line.accountName}</td>
                              <td className="py-2 px-4 text-right text-emerald-500">
                                {line.debit > 0 ? `S/ ${line.debit.toFixed(2)}` : '-'}
                              </td>
                              <td className="py-2 px-4 text-right text-amber-500">
                                {line.credit > 0 ? `S/ ${line.credit.toFixed(2)}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================================= */}
      {/* 2. VISTA DE PADRES DE FAMILIA (PARENT BILLING DASHBOARD) */}
      {/* ========================================================================================= */}
      {user?.roleId === 'r-tenant1-parent' && parentData && (
        <div className="space-y-6">
          
          {/* BANNER DE HIJOS ASOCIADOS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Alumnos asociados */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Estudiantes a cargo</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {parentData.children.map((c: any) => `${c.first_name} ${c.last_name}`).join(', ')}
                </div>
              </div>
            </div>

            {/* Deuda Pendiente */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Pensión Pendiente</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    S/ {parentData.metrics.totalOutstanding.toFixed(2)}
                  </div>
                </div>
              </div>
              {parentData.metrics.overdueOutstanding > 0 && (
                <span className="bg-rose-950 text-rose-400 border border-rose-900 text-[9px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">
                  Vencido: S/ {parentData.metrics.overdueOutstanding.toFixed(2)}
                </span>
              )}
            </div>

            {/* Total Cancelado */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Pagos Realizados (Mayo 2026)</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  S/ {parentData.metrics.paidTotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Lista de recibos pendientes de pago */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                Recibos de Pensiones Académicas Pendientes
              </h3>
              <p className="text-xs text-slate-400">
                Paga tus pensiones en línea a través de nuestra pasarela Stripe con total seguridad.
              </p>

              <div className="space-y-3 mt-4">
                {parentData.receivables.filter((r: any) => r.status !== 'PAID').map((rec: any) => (
                  <div key={rec.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex justify-between items-center gap-4 hover:border-slate-700 transition">
                    <div className="space-y-1">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${rec.status === 'OVERDUE' ? 'bg-rose-950 text-rose-400 border border-rose-900' : 'bg-amber-950 text-amber-400 border border-amber-900'}`}>
                        {rec.status === 'OVERDUE' ? 'VENCIDO' : 'POR VENCER'}
                      </span>
                      <h4 className="text-sm font-bold text-slate-200">{rec.concept}</h4>
                      <p className="text-[10px] text-slate-500">
                        Estudiante: {rec.student_first_name} {rec.student_last_name} • Vencimiento: {rec.due_date.substring(0, 10)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-white">S/ {(rec.amount - rec.paid_amount).toFixed(2)}</div>
                        <div className="text-[9px] text-slate-500">Total: S/ {rec.amount.toFixed(2)}</div>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedReceivable(rec);
                          setIsPayModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs tracking-wide shadow-md transition"
                      >
                        Pagar
                      </button>
                    </div>
                  </div>
                ))}

                {parentData.receivables.filter((r: any) => r.status !== 'PAID').length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-800 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                    <h4 className="text-sm font-bold text-slate-300">¡Al día con las pensiones!</h4>
                    <p className="text-xs text-slate-500 mt-1">No registras cobros o deudas académicas pendientes.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Historial de Pagos y Facturación Electrónica */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                Historial de Pagos y Comprobantes
              </h3>
              
              <div className="space-y-4 mt-4">
                {parentData.payments.map((tx: any) => {
                  const hasInvoice = tx.metadata && tx.metadata.invoice_status === 'ISSUED';
                  return (
                    <div key={tx.id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div className="text-xs text-slate-400">{tx.concept}</div>
                        <div className="text-xs font-extrabold text-emerald-400">S/ {Number(tx.amount).toFixed(2)}</div>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <div>Vía Stripe • {new Date(tx.transaction_date).toLocaleDateString('es-PE')}</div>
                        
                        {hasInvoice ? (
                          <div className="flex gap-2 items-center">
                            <span className="text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded text-[9px] border border-emerald-900/50">
                              {tx.metadata.invoice_number}
                            </span>
                            <a 
                              href={tx.metadata.invoice_pdf} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-slate-300 hover:text-emerald-400 flex items-center gap-0.5 transition"
                            >
                              <Download className="w-3 h-3" /> PDF
                            </a>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleGenerateInvoice(tx.id)}
                            disabled={isInvoiceGenerating === tx.id}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded text-[9px] font-bold flex items-center gap-1 transition"
                          >
                            {isInvoiceGenerating === tx.id ? (
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <FileText className="w-2.5 h-2.5" />
                            )}
                            Emitir Boleta
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {parentData.payments.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">No has registrado transacciones en línea en este periodo.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* 3. VISTA DE PROFESOR (PROFESSOR STATEMENT DASHBOARD) */}
      {/* ========================================================================================= */}
      {user?.roleId === 'r-tenant1-professor' && professorData && (
        <div className="space-y-6">
          
          {/* TABLERO DE CARD DE PAGOS Y HORAS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Tarifa por Hora Dictada</div>
              <div className="text-2xl font-bold text-white mt-1">
                S/ {professorData.professor.hourlyRate.toFixed(2)} <span className="text-xs text-slate-500 font-normal">/ hora</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Horas Acumuladas Enseñadas</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {professorData.metrics.hoursWorked} <span className="text-xs text-slate-500 font-normal">horas</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                De {professorData.metrics.totalClasses} clases programadas en Mayo 2026.
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-400">Total Ganado Acumulado</div>
              <div className="text-2xl font-bold text-white mt-1">
                S/ {professorData.metrics.totalEarned.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-amber-950/10">
              <div className="text-xs text-slate-400">Honorarios Pendientes de Pago</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                S/ {professorData.metrics.totalPending.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Lista de nóminas emitidas y estado de pagos */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Estado de Cuenta de Honorarios de Facultad
              </h3>
              
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Concepto / Periodo</th>
                      <th className="py-3 px-4 text-right">Monto Bruto</th>
                      <th className="py-3 px-4 text-right">Pagado</th>
                      <th className="py-3 px-4 text-center">F. Venc.</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {professorData.payables.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-800/20 text-slate-300">
                        <td className="py-3 px-4 font-semibold text-slate-200">{p.concept}</td>
                        <td className="py-3 px-4 text-right font-medium">S/ {Number(p.amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-medium">S/ {Number(p.paid_amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-center text-slate-400">{p.due_date.substring(0, 10)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            p.status === 'PAID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-amber-950 text-amber-400 border border-amber-900'
                          }`}>
                            {p.status === 'PAID' ? 'LIQUIDADO' : 'PENDIENTE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Asistencia y Clases registradas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                Bitácora de Clases y Asistencia (Mayo 2026)
              </h3>
              
              <div className="space-y-3 mt-4 max-h-[350px] overflow-y-auto pr-1">
                {professorData.attendance.map((a: any) => (
                  <div key={a.id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-200">Fecha de dictado: {a.class_date.substring(0, 10)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Materia: Álgebra Avanzada • Horas prog: {Number(a.scheduled_hours)} hrs</div>
                    </div>
                    
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                        a.status === 'PRESENT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-rose-950 text-rose-400 border border-rose-900'
                      }`}>
                        {a.status === 'PRESENT' ? `Asistió: ${Number(a.hours_worked)} hrs` : 'Inasistencia'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 1: PROCESAMIENTO DE PAGO DE APODERADO (SIMULADOR DE PASARELA STRIPE) */}
      {/* ========================================================================================= */}
      {isPayModalOpen && selectedReceivable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Pasarela de Pago Stripe (Simulado)
              </h3>
              <button 
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition text-sm font-semibold"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-slate-400 text-xs font-semibold">Concepto a Pagar:</div>
              <div className="p-3 bg-slate-950/50 rounded-xl text-slate-200 text-sm border border-slate-850">
                {selectedReceivable.concept}
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-slate-500">Monto del Recibo:</span>
                <span className="font-bold text-white">S/ {selectedReceivable.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-850 pt-2 font-bold text-emerald-400">
                <span>Neto a Debitar de la Tarjeta:</span>
                <span>S/ {(selectedReceivable.amount - selectedReceivable.paid_amount).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleSimulatePayment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Número de Tarjeta</label>
                <input 
                  type="text" 
                  value={cardNumber} 
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none transition font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Fecha Expiración</label>
                  <input 
                    type="text" 
                    value={cardExpiry} 
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM / AA"
                    maxLength={5}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none transition font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">CVC</label>
                  <input 
                    type="text" 
                    value={cardCvc} 
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="123"
                    maxLength={3}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none transition font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isPaying}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 transition"
              >
                {isPaying ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4" />
                    Procesando Transacción ACID...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Pagar con Tarjeta S/ {(selectedReceivable.amount - selectedReceivable.paid_amount).toFixed(2)}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RENDER ALERTA DE TRANSACCIÓN EXITOSA + EMISIÓN DE NUBEFACT DIRECTO */}
      {paymentSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-950 rounded-2xl shadow-2xl p-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mx-auto">
              <Check className="w-8 h-8 font-black" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">¡Cobro Registrado Correctamente!</h3>
              <p className="text-xs text-slate-400">
                La transacción Stripe finalizó exitosamente y se registró el asiento contable balanceado en el Libro Mayor contable del colegio.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl text-left border border-slate-850 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Transacción ID:</span>
                <span className="text-slate-200">{paymentSuccessData.transaction.id.substring(0, 18)}...</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Método de Pago:</span>
                <span className="text-slate-200">STRIPE Gateway</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Monto Debitado:</span>
                <span className="text-emerald-400 font-bold">S/ {Number(paymentSuccessData.transaction.amount).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  const txId = paymentSuccessData.transaction.id;
                  setPaymentSuccessData(null);
                  handleGenerateInvoice(txId);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <FileText className="w-4 h-4" /> Emitir Factura Electrónica (NubeFacT)
              </button>
              <button 
                onClick={() => setPaymentSuccessData(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Cerrar y Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DE COMPROBANTE NUBEFACT EMITIDO */}
      {generatedInvoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-400 mx-auto">
              <Printer className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Comprobante de Pago Electrónico Emitido</h3>
              <p className="text-xs text-slate-400">
                El comprobante fue declarado con validez fiscal y enviado a la autoridad local de forma automática.
              </p>
            </div>

            <div className="p-3 bg-teal-950/15 rounded-xl border border-teal-900/30 text-teal-400 text-xs font-bold font-mono">
              COMPROBANTE: {generatedInvoiceData.invoiceNumber}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a 
                href={generatedInvoiceData.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                <Download className="w-4 h-4 text-emerald-400" /> Descargar PDF
              </a>
              <a 
                href={generatedInvoiceData.xmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                <FileText className="w-4 h-4 text-amber-400" /> Descargar XML
              </a>
            </div>

            <button 
              onClick={() => setGeneratedInvoiceData(null)}
              className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 2: CREACIÓN DE RECIBO / MANUAL COBRO DE ADMIN */}
      {/* ========================================================================================= */}
      {isNewRecModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Emitir Nueva Cuenta por Cobrar (AR)</h3>
              <button onClick={() => setIsNewRecModalOpen(false)} className="text-slate-400 text-sm font-semibold">Cerrar</button>
            </div>

            <form onSubmit={handleCreateReceivable} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Alumno Destinatario</label>
                <select 
                  value={newRecData.studentId}
                  onChange={(e) => setNewRecData({ ...newRecData, studentId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="st-1">Alejandro Mendoza Torres (MAT-2026-0001)</option>
                  <option value="st-2">Valeria Campos Espinoza (MAT-2026-0002)</option>
                  <option value="st-3">Bruno García Paredes (MAT-2026-0003)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Concepto de Cobro</label>
                <input 
                  type="text" 
                  value={newRecData.concept}
                  onChange={(e) => setNewRecData({ ...newRecData, concept: e.target.value })}
                  placeholder="ej: Pensión de Mensualidad Escolar Junio 2026"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Importe (S/)</label>
                  <input 
                    type="number" 
                    value={newRecData.amount}
                    onChange={(e) => setNewRecData({ ...newRecData, amount: e.target.value })}
                    placeholder="450.00"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Vencimiento</label>
                  <input 
                    type="date" 
                    value={newRecData.dueDate}
                    onChange={(e) => setNewRecData({ ...newRecData, dueDate: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
              >
                Emitir y Contabilizar en Ledger
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 3: REGISTRO DE CUENTA POR PAGAR MANUAL DE ADMIN */}
      {/* ========================================================================================= */}
      {isNewPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Registrar Nueva Cuenta por Pagar (AP)</h3>
              <button onClick={() => setIsNewPayModalOpen(false)} className="text-slate-400 text-sm font-semibold">Cerrar</button>
            </div>

            <form onSubmit={handleCreatePayable} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Beneficiario Docente</label>
                <select 
                  value={newPayData.professorId}
                  onChange={(e) => setNewPayData({ ...newPayData, professorId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="p-1">Mateo Silva (Especialista en Matemáticas)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Concepto de Gasto</label>
                <input 
                  type="text" 
                  value={newPayData.concept}
                  onChange={(e) => setNewPayData({ ...newPayData, concept: e.target.value })}
                  placeholder="ej: Pago de Honorarios Extraordinarios Talleres Mayo"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Importe (S/)</label>
                  <input 
                    type="number" 
                    value={newPayData.amount}
                    onChange={(e) => setNewPayData({ ...newPayData, amount: e.target.value })}
                    placeholder="350.00"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Vencimiento</label>
                  <input 
                    type="date" 
                    value={newPayData.dueDate}
                    onChange={(e) => setNewPayData({ ...newPayData, dueDate: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition"
              >
                Proveer Gasto y Contabilizar en Ledger
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 4: PROCESADOR INTEGRAL DE NÓMINA (CRUCE CON ASISTENCIA DOCENTE) */}
      {/* ========================================================================================= */}
      {isPayrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-400" />
                Procesar Nómina Mensual de Profesores
              </h3>
              <button 
                onClick={() => {
                  setIsPayrollModalOpen(false);
                  setCalculatedPayroll(null);
                }} 
                className="text-slate-400 text-sm font-semibold"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Profesor Docente</label>
                <select 
                  value={selectedProfId}
                  onChange={(e) => {
                    setSelectedProfId(e.target.value);
                    setCalculatedPayroll(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="p-1">Mateo Silva (Tarifa: S/ 50.00/hr)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Mes de liquidación</label>
                <input 
                  type="month" 
                  value={payrollPeriod}
                  onChange={(e) => {
                    setPayrollPeriod(e.target.value);
                    setCalculatedPayroll(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={handleCalculatePayroll}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs transition"
              >
                Calcular Nómina Cruzada
              </button>
            </div>

            {/* Resultado del Cálculo Cruzado de Asistencia */}
            {calculatedPayroll && (
              <div className="space-y-4 border-t border-slate-800 pt-4 animate-fadeIn">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Boleta de Liquidación de Pre-Nómina</h4>
                
                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
                  <div className="space-y-1.5">
                    <div className="text-slate-500">Clases Programadas:</div>
                    <div className="font-bold text-slate-200">{calculatedPayroll.metrics.totalClasses} Sesiones ({calculatedPayroll.metrics.totalScheduledHours} hrs)</div>
                    
                    <div className="text-slate-500">Horas Trabajadas:</div>
                    <div className="font-bold text-emerald-400">{calculatedPayroll.metrics.totalHoursWorked} hrs</div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-slate-500">Inasistencias Registradas:</div>
                    <div className="font-bold text-rose-400">{calculatedPayroll.metrics.absences} Faltas</div>
                    
                    <div className="text-slate-500">Cruce con Asistencia:</div>
                    <div className="font-bold text-slate-300">
                      {calculatedPayroll.config.deductAbsencesFromPayroll ? 'Activo (Horas Trabajadas)' : 'Desactivado (Horas Progr.)'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-950/50 p-4 rounded-xl border border-slate-850 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Honorarios Brutos:</span>
                    <span className="font-semibold text-slate-200">S/ {calculatedPayroll.calculation.grossPayroll.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2 text-rose-400">
                    <span>Descuentos por Inasistencias:</span>
                    <span>- S/ {calculatedPayroll.calculation.deductions.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-teal-300 pt-1">
                    <span>Monto Neto a Liquidar:</span>
                    <span>S/ {calculatedPayroll.calculation.netPayroll.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  onClick={handleProcessPayroll}
                  disabled={isPayrollProcessing}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 tracking-wide shadow"
                >
                  {isPayrollProcessing ? (
                    <>
                      <RefreshCw className="animate-spin w-4 h-4" />
                      Procesando ACID Transacción...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Confirmar, Registrar y Contabilizar Nómina
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
}
