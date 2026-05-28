'use client';

import { getApiUrl } from '@/lib/config';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Users, 
  MapPin, 
  TrendingUp,
  Shield,
  Check,
  Save,
  Plus,
  RefreshCw,
  Info,
  Building,
  MonitorPlay,
  CalendarCheck,
  Clock,
  UserCheck
} from 'lucide-react';

interface RoleOption {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
}

interface MenuPermissionConfig {
  menuOptionId: string;
  title: string;
  module: string;
  icon: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export default function DashboardPage() {
  const { user, tenant, token, checkAuth } = useAuthStore();
  
  // Color primario de acento dinámico según el Tenant
  const activeColor = tenant?.primaryColor || '#6B8E4E';

  return (
    <div className="space-y-8 font-sans">
      
      {/* 1. SECCIÓN DE ENCABEZADO DE BIENVENIDA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(28,44,53,0.02)]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1C2C35]">
            ¡Hola, {user?.firstName} {user?.lastName}! 👋
          </h1>
          <p className="text-[#1C2C35]/60 text-xs md:text-sm mt-1">
            {user?.roleId === 'r-superadmin' 
              ? 'Consola de administración global de SincroEdu. Monitorea y administra todas las instituciones.'
              : `Bienvenido al panel general de ${tenant?.name || 'su institución'}.`}
          </p>
        </div>
        
        {tenant && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-[#1C2C35]/70 uppercase tracking-wider">
              {tenant.name} ({tenant.status})
            </span>
          </div>
        )}
      </div>

      {/* 2. TARJETAS DE KPIS PRINCIPALES (REDISEÑADAS SEGÚN REQUERIMIENTO) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* KPI 1: Sedes (Total vs Activas) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sedes Institucionales</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-[#1C2C35]">4 Sedes</span>
              <span className="text-xs font-semibold text-slate-400">totales</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              3 Sedes Activas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E] group-hover:scale-110 transition-transform">
            <Building className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Aulas Físicas (Total vs Activas) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aulas Físicas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-[#1C2C35]">24 Aulas</span>
              <span className="text-xs font-semibold text-slate-400">instaladas</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              20 Aulas Activas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Aulas Virtuales (Total vs Activas) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aulas Virtuales</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-[#1C2C35]">12 Aulas</span>
              <span className="text-xs font-semibold text-slate-400">creadas</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              12 Aulas Activas
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
            <MonitorPlay className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Tasa de Asistencia */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tasa de Asistencia</span>
            <span className="text-3xl font-extrabold text-[#1C2C35] block">95.4%</span>
            <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">Ciclo Escolar Activo</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 5: Ocupabilidad de horas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horas Usadas vs Disponibles</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#1C2C35]">78.2%</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">312h / 400h</span>
            </div>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full block mt-1">Ocupabilidad Horas Aula</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 6: Profesores Vigentes */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgba(28,44,53,0.015)] flex items-center justify-between group hover:scale-[1.01] hover:shadow-[0_10px_35px_rgba(28,44,53,0.03)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profesores Vigentes</span>
            <span className="text-3xl font-extrabold text-[#1C2C35] block">48 Activos</span>
            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">Contratos Vigentes</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

      </section>

    </div>
  );
}
