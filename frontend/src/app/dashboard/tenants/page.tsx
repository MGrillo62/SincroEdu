'use client';

import { getApiUrl } from '@/lib/config';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import DataTable, { Column } from '@/components/ui/data-table';
import { 
  Globe, 
  Plus, 
  MapPin, 
  Phone, 
  Mail, 
  Edit3, 
  Settings, 
  CheckCircle, 
  RefreshCw, 
  X, 
  ZoomIn, 
  ZoomOut, 
  Compass, 
  Navigation,
  Building,
  Wrench,
  XSquare,
  History,
  Link as LinkIcon
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  status: 'active' | 'suspended' | 'trial';
  fiscalId?: string;
  address?: string;
  phone?: string;
  email?: string;
  domain?: string;
  country?: string;
  currency?: string;
  startDate?: string;
  endDate?: string | null;
  paymentGateway?: 'stripe' | 'culqui' | 'conekta';
  billingPlan?: 'membership';
}

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

// Direcciones geolocalizables precargadas para la asistencia inteligente
const PRESET_ADDRESSES = [
  { text: 'Av. Aurelio Miró Quesada 450, San Isidro, Lima, Perú', lat: -12.0945, lng: -77.0321, label: 'Centro Financiero San Isidro' },
  { text: 'Calle Monterrey 340, Santiago de Surco, Lima, Perú', lat: -12.1287, lng: -76.9765, label: 'Zona Tecnológica Surco' },
  { text: 'Av. Javier Prado Este 2465, San Borja, Lima, Perú', lat: -12.0883, lng: -77.0094, label: 'Corredor Javier Prado' },
  { text: 'Av. Larco 770, Miraflores, Lima, Perú', lat: -12.1219, lng: -77.0298, label: 'Litoral Costero Miraflores' },
  { text: 'Av. Salaverry 2800, Jesús María, Lima, Perú', lat: -12.0851, lng: -77.0512, label: 'Sector Educativo Salaverry' },
  { text: 'Av. La Marina 1500, Pueblo Libre, Lima, Perú', lat: -12.0792, lng: -77.0784, label: 'Zona Comercial La Marina' }
];

export default function TenantsPage() {
  const { user, token } = useAuthStore();
  const [tenantsList, setTenantsList] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Campos de Formulario Tenant
  const [tenantName, setTenantName] = useState('');
  const [tenantSubdomain, setTenantSubdomain] = useState('');
  const [tenantFiscalId, setTenantFiscalId] = useState('');
  const [tenantAddress, setTenantAddress] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [tenantPrimaryColor, setTenantPrimaryColor] = useState('#6B8E4E');
  const [tenantStatus, setTenantStatus] = useState<'active' | 'suspended' | 'trial'>('active');
  const [tenantCountry, setTenantCountry] = useState('Perú');
  const [tenantCurrency, setTenantCurrency] = useState('PEN');
  const [tenantStartDate, setTenantStartDate] = useState('');
  const [tenantEndDate, setTenantEndDate] = useState('');
  const [tenantPaymentGateway, setTenantPaymentGateway] = useState<'stripe' | 'culqui' | 'conekta'>('culqui');
  const [tenantBillingPlan, setTenantBillingPlan] = useState<'membership'>('membership');

  // Geolocalización y Asistente de Mapas
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<typeof PRESET_ADDRESSES>([]);
  const [mapCenter, setMapCenter] = useState({ lat: -12.0945, lng: -77.0321 });
  const [mapZoom, setMapZoom] = useState(1);
  const [selectedPresetLabel, setSelectedPresetLabel] = useState('Ubicación Referencial');

  // Cajón lateral de Sedes por Tenant (Súper Consola)
  const [isCampusDrawerOpen, setIsCampusDrawerOpen] = useState(false);
  const [drawerTenant, setDrawerTenant] = useState<Tenant | null>(null);
  const [campusesList, setCampusesList] = useState<Campus[]>([]);
  const [loadingCampuses, setLoadingCampuses] = useState(false);

  // Formulario de Nueva Sede en Cajón
  const [isCampusFormOpen, setIsCampusFormOpen] = useState(false);
  const [campusName, setCampusName] = useState('');
  const [campusType, setCampusType] = useState<'physical' | 'virtual'>('physical');
  const [campusAddress, setCampusAddress] = useState('');
  const [campusCapacity, setCampusCapacity] = useState(100);

  // Cargar Tenants
  const fetchTenants = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setTenantsList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user?.roleId === 'r-superadmin') {
      fetchTenants();
    }
  }, [token, user]);

  // Manejar Escritura de Dirección
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressQuery(val);
    setTenantAddress(val);

    if (val.trim().length > 2) {
      const filtered = PRESET_ADDRESSES.filter(addr => 
        addr.text.toLowerCase().includes(val.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  // Seleccionar Dirección Asistida
  const selectSuggestion = (suggestion: typeof PRESET_ADDRESSES[0]) => {
    setTenantAddress(suggestion.text);
    setAddressQuery(suggestion.text);
    setMapCenter({ lat: suggestion.lat, lng: suggestion.lng });
    setSelectedPresetLabel(suggestion.label);
    setSuggestions([]);
  };

  // Abrir Formulario Tenant
  const openCreateForm = () => {
    setEditMode(false);
    setTenantName('');
    setTenantSubdomain('');
    setTenantFiscalId('');
    setTenantAddress('');
    setAddressQuery('');
    setTenantPhone('');
    setTenantEmail('');
    setTenantDomain('');
    setTenantPrimaryColor('#6B8E4E');
    setTenantStatus('active');
    setTenantCountry('Perú');
    setTenantCurrency('PEN');
    setTenantStartDate(new Date().toISOString().split('T')[0]);
    setTenantEndDate('');
    setTenantPaymentGateway('culqui');
    setTenantBillingPlan('membership');
    setMapCenter({ lat: -12.0945, lng: -77.0321 });
    setSelectedPresetLabel('Ubicación Referencial');
    setIsFormOpen(true);
  };

  const openEditForm = (tenant: Tenant) => {
    setEditMode(true);
    setSelectedTenant(tenant);
    setTenantName(tenant.name);
    setTenantSubdomain(tenant.subdomain);
    setTenantFiscalId(tenant.fiscalId || '');
    setTenantAddress(tenant.address || '');
    setAddressQuery(tenant.address || '');
    setTenantPhone(tenant.phone || '');
    setTenantEmail(tenant.email || '');
    setTenantDomain(tenant.domain || '');
    setTenantPrimaryColor(tenant.primaryColor);
    setTenantStatus(tenant.status);
    setTenantCountry(tenant.country || 'Perú');
    setTenantCurrency(tenant.currency || 'PEN');
    setTenantStartDate(tenant.startDate || '');
    setTenantEndDate(tenant.endDate || '');
    setTenantPaymentGateway(tenant.paymentGateway || 'culqui');
    setTenantBillingPlan(tenant.billingPlan || 'membership');

    // Buscar si corresponde a una dirección precargada para centrar el mapa
    const matchingPreset = PRESET_ADDRESSES.find(preset => preset.text === tenant.address);
    if (matchingPreset) {
      setMapCenter({ lat: matchingPreset.lat, lng: matchingPreset.lng });
      setSelectedPresetLabel(matchingPreset.label);
    } else {
      setMapCenter({ lat: -12.0945, lng: -77.0321 });
      setSelectedPresetLabel('Ubicación Manual');
    }

    setIsFormOpen(true);
  };

  // Enviar Formulario Tenant
  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const url = editMode 
      ? `${getApiUrl()}/tenants/${selectedTenant?.id}`
      : `${getApiUrl()}/tenants`;
    const method = editMode ? 'PUT' : 'POST';
    const body = {
      name: tenantName,
      subdomain: tenantSubdomain,
      fiscalId: tenantFiscalId,
      address: tenantAddress,
      phone: tenantPhone,
      email: tenantEmail,
      domain: tenantDomain || `${tenantSubdomain}.sincroedu.edu.pe`,
      primaryColor: tenantPrimaryColor,
      secondaryColor: '#1C2C35',
      status: tenantStatus,
      country: tenantCountry,
      currency: tenantCurrency,
      startDate: tenantStartDate,
      endDate: tenantEndDate || null,
      paymentGateway: tenantPaymentGateway,
      billingPlan: tenantBillingPlan
    };

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
        fetchTenants();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al procesar el Tenant');
    }
  };

  // Gestión de Sedes: Cargar Sedes de Tenant
  const openCampusesDrawer = async (tenant: Tenant) => {
    setDrawerTenant(tenant);
    setIsCampusDrawerOpen(true);
    setIsCampusFormOpen(false);
    fetchCampuses(tenant.id);
  };

  const fetchCampuses = async (tenantId: string) => {
    if (!token) return;
    setLoadingCampuses(true);
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${tenantId}/campuses`, {
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
      setLoadingCampuses(false);
    }
  };

  // Enviar Formulario de Nueva Sede (Súper Consola)
  const handleCampusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !drawerTenant) return;

    try {
      const res = await fetch(`${getApiUrl()}/tenants/${drawerTenant.id}/campuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: campusName,
          type: campusType,
          address: campusAddress,
          capacity: campusCapacity,
          status: 'active'
        })
      });
      if (res.ok) {
        setCampusName('');
        setCampusAddress('');
        setCampusCapacity(100);
        setIsCampusFormOpen(false);
        fetchCampuses(drawerTenant.id);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cambiar Estado de Sede desde Súper Consola
  const handleCampusStatusToggle = async (campus: Campus, newStatus: 'active' | 'maintenance' | 'closed') => {
    if (!token || !drawerTenant) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenants/${drawerTenant.id}/campuses/${campus.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchCampuses(drawerTenant.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Columnas para DataTable de Tenants
  const columns: Column<Tenant>[] = [
    {
      accessor: 'name',
      label: 'Colegio / Institución Educativa',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-black text-sm shadow-md"
            style={{ backgroundColor: row.primaryColor }}
          >
            {row.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-850 text-xs md:text-sm">{row.name}</span>
            <span className="text-[10px] text-slate-450 font-medium">Subdominio: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{row.subdomain}</code></span>
          </div>
        </div>
      )
    },
    {
      accessor: 'fiscalId',
      label: 'ID Fiscal / RUC',
      sortable: true,
      render: (row) => <span className="font-mono text-xs text-slate-650 bg-slate-50 px-2 py-1 border border-slate-100 rounded-lg">{row.fiscalId || '-'}</span>
    },
    {
      accessor: 'email',
      label: 'Contacto de la Escuela',
      render: (row) => (
        <div className="flex flex-col text-[11px] space-y-0.5">
          <span className="text-slate-600 font-semibold flex items-center gap-1">
            <Mail className="w-3 h-3 text-slate-400" />
            {row.email || '-'}
          </span>
          <span className="text-slate-400 flex items-center gap-1">
            <Phone className="w-3 h-3 text-slate-400" />
            {row.phone || '-'}
          </span>
        </div>
      )
    },
    {
      accessor: 'domain',
      label: 'Dominio de Acceso',
      render: (row) => (
        <a 
          href={`https://${row.domain}`} 
          target="_blank" 
          rel="noreferrer" 
          className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
        >
          <Globe className="w-3.5 h-3.5" />
          {row.domain || '-'}
        </a>
      )
    },
    {
      accessor: 'country',
      label: 'Facturación / Pasarela',
      render: (row) => (
        <div className="flex flex-col text-[11px] space-y-0.5">
          <span className="text-slate-800 font-extrabold flex items-center gap-1">
            {row.country === 'Perú' ? '🇵🇪 Perú' : row.country === 'México' ? '🇲🇽 México' : row.country === 'EEUU' ? '🇺🇸 EEUU' : '🌐 Otros'}
            <span className="text-slate-400 font-medium font-mono">({row.currency || 'USD'})</span>
          </span>
          <span className="text-slate-500 font-medium flex items-center gap-1.5 uppercase text-[9px]">
            <span className={`px-1.5 py-0.2 rounded font-black text-[9px] ${
              row.paymentGateway === 'stripe' ? 'bg-indigo-50 text-indigo-700' :
              row.paymentGateway === 'culqui' ? 'bg-emerald-50 text-emerald-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              {row.paymentGateway || 'stripe'}
            </span>
            <span>Membresía</span>
          </span>
        </div>
      )
    },
    {
      accessor: 'status',
      label: 'Licencia / Estado',
      sortable: true,
      render: (row) => {
        const colors = {
          active: 'bg-green-55 bg-opacity-10 text-green-700 border-green-200/50',
          suspended: 'bg-red-55 bg-opacity-10 text-red-700 border-red-200/50',
          trial: 'bg-blue-55 bg-opacity-10 text-blue-700 border-blue-200/50'
        };
        const text = {
          active: 'Activo / Licenciado',
          suspended: 'Suspendido',
          trial: 'Periodo de Prueba'
        };
        return (
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${colors[row.status]}`}>
            {text[row.status]}
          </span>
        );
      }
    },
    {
      accessor: 'acciones',
      label: 'Acciones de Consola',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditForm(row)}
            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-650 flex items-center gap-1 font-semibold text-xs cursor-pointer border border-slate-200"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            Editar Ficha
          </button>
          <button
            onClick={() => openCampusesDrawer(row)}
            className="p-1.5 bg-[#6B8E4E]/10 hover:bg-[#6B8E4E]/20 text-[#6B8E4E] border border-[#6B8E4E]/25 rounded-xl flex items-center gap-1 font-extrabold text-xs cursor-pointer"
          >
            <Building className="w-3.5 h-3.5" />
            Gestionar Sedes
          </button>
        </div>
      )
    }
  ];

  if (user?.roleId !== 'r-superadmin') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-500">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Acceso Restringido</h2>
        <p className="text-slate-500 text-xs max-w-sm">Esta sección de administración es exclusiva para el rol Superadmin global del ecosistema SincroEdu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. CABECERA GLOBAL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -z-10" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1C2C35]">Consola de Configuración de Tenants</h1>
            <p className="text-xs text-slate-400">Panel global para crear y licenciar colegios, gestionar subdominios, colores y controlar aforos Multi-Tenant.</p>
          </div>
        </div>

        <button 
          onClick={openCreateForm}
          className="px-4.5 py-3 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-md hover:scale-[1.01] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Tenant Escolar
        </button>
      </div>

      {/* 2. CARD DE KPIS DE LA RED */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Instituciones Licenciadas</span>
            <span className="text-2xl font-black text-slate-800">{tenantsList.length} Colegios</span>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">100% Operativos</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#6B8E4E]/10 flex items-center justify-center text-[#6B8E4E]">
            <Globe className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Aforo Global Integrado</span>
            <span className="text-2xl font-black text-slate-800">5,770 Alumnos</span>
            <span className="text-[10px] text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">Capacidad Curricular</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <Compass className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sedes y Laboratorios</span>
            <span className="text-2xl font-black text-slate-800">3 Infraestructuras</span>
            <span className="text-[10px] text-blue-650 bg-blue-50 px-2 py-0.5 rounded-full font-bold">Sedes Centralizadas</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* 3. TABLA DE TENANTS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#6B8E4E]" />
            Sincronizando colegios en la red...
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={tenantsList} 
            searchPlaceholder="Buscar escuela por nombre..."
            searchAccessor="name"
          />
        )}
      </div>

      {/* 4. MODAL: REGISTRO / EDICIÓN DE TENANT (CON GEOLOCALIZACIÓN Y MAPA) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            
            {/* Cabecera */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-black text-[#1C2C35]">
                  {editMode ? 'Modificar Ficha de la Escuela' : 'Registrar Nueva Escuela en la Red'}
                </h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Asigna el dominio corporativo, la configuración geográfica y los colores del portal.</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scroll */}
            <form onSubmit={handleTenantSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Columna Izquierda: Datos del Tenant */}
                <div className="lg:col-span-6 space-y-4">
                  <h4 className="text-xs font-black text-[#6B8E4E] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <Settings className="w-4 h-4" />
                    1. Información General del Colegio
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Nombre del Colegio</label>
                      <input 
                        type="text"
                        required
                        placeholder="ej: Colegio San Ignacio"
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Subdominio Escolar</label>
                      <input 
                        type="text"
                        required
                        disabled={editMode}
                        placeholder="ej: san-ignacio"
                        value={tenantSubdomain}
                        onChange={(e) => setTenantSubdomain(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Identificador Fiscal / RUC</label>
                      <input 
                        type="text"
                        required
                        placeholder="ej: 20601234567"
                        value={tenantFiscalId}
                        onChange={(e) => setTenantFiscalId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Dominio Propio</label>
                      <input 
                        type="text"
                        placeholder="ej: sanignacio.edu.pe"
                        value={tenantDomain}
                        onChange={(e) => setTenantDomain(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Teléfono de Contacto</label>
                      <input 
                        type="text"
                        placeholder="ej: +51 1 615-5800"
                        value={tenantPhone}
                        onChange={(e) => setTenantPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Email de Contacto</label>
                      <input 
                        type="email"
                        required
                        placeholder="ej: secretaria@sanignacio.edu.pe"
                        value={tenantEmail}
                        onChange={(e) => setTenantEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Color Primario Corporativo</label>
                      <div className="flex gap-2">
                        <input 
                          type="color"
                          value={tenantPrimaryColor}
                          onChange={(e) => setTenantPrimaryColor(e.target.value)}
                          className="w-10 h-8 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 p-0.5"
                        />
                        <input 
                          type="text"
                          value={tenantPrimaryColor}
                          onChange={(e) => setTenantPrimaryColor(e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#6B8E4E]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Estado de Licencia</label>
                      <select
                        value={tenantStatus}
                        onChange={(e) => setTenantStatus(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850 cursor-pointer"
                      >
                        <option value="active">Activo</option>
                        <option value="trial">Periodo de Prueba</option>
                        <option value="suspended">Suspendido / Inactivo</option>
                      </select>
                    </div>
                  </div>

                  {/* 3. FACTURACIÓN Y PASARELAS DE PAGO POR PAÍS */}
                  <h4 className="text-xs font-black text-[#6B8E4E] uppercase tracking-wider border-b border-slate-100 pb-1.5 pt-4 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" />
                    3. Licencia por Uso y Facturación (Membresía)
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">País de Operación</label>
                      <select
                        value={tenantCountry}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTenantCountry(val);
                          if (val === 'Perú') {
                            setTenantCurrency('PEN');
                            setTenantPaymentGateway('culqui');
                          } else if (val === 'México') {
                            setTenantCurrency('MXN');
                            setTenantPaymentGateway('conekta');
                          } else if (val === 'EEUU') {
                            setTenantCurrency('USD');
                            setTenantPaymentGateway('stripe');
                          } else {
                            setTenantCurrency('USD');
                            setTenantPaymentGateway('stripe');
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850 cursor-pointer"
                      >
                        <option value="Perú">Perú 🇵🇪</option>
                        <option value="México">México 🇲🇽</option>
                        <option value="EEUU">Estados Unidos 🇺🇸</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Moneda de Facturación</label>
                      <input 
                        type="text"
                        disabled
                        value={`${tenantCurrency} (${tenantCurrency === 'PEN' ? 'Soles' : tenantCurrency === 'MXN' ? 'Pesos Mex.' : 'Dólares US'})`}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-100 font-bold text-slate-600 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Modelo de Pago</label>
                      <input 
                        type="text"
                        disabled
                        value="Licencia por uso (Membresía)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-100 font-bold text-slate-600 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Pasarela Integrada</label>
                      <div className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between text-xs font-black">
                        <span className="text-slate-850 capitalize font-extrabold">{tenantPaymentGateway}</span>
                        {tenantPaymentGateway === 'stripe' ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">STRIPE SECURE</span>
                        ) : tenantPaymentGateway === 'culqui' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">CULQUI API</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">CONEKTA PAY</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Fecha de Inicio de Licencia</label>
                      <input 
                        type="date"
                        required
                        value={tenantStartDate}
                        onChange={(e) => setTenantStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Fecha de Cierre (Opcional)</label>
                      <input 
                        type="date"
                        value={tenantEndDate || ''}
                        onChange={(e) => setTenantEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-[#6B8E4E] focus:bg-white transition-all font-bold text-slate-850"
                      />
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Geolocalización Inteligente y Mapa */}
                <div className="lg:col-span-6 space-y-4">
                  <h4 className="text-xs font-black text-[#6B8E4E] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    2. Configuración y Ubicación Geográfica
                  </h4>

                  {/* Asistente de Autocompletado */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Escriba la dirección de la sede central</label>
                    <div className="relative">
                      <input 
                        type="text"
                        required
                        placeholder="Comience a escribir la dirección..."
                        value={addressQuery}
                        onChange={handleAddressChange}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#6B8E4E] transition-all font-bold text-slate-850"
                      />
                      <Compass className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Suggestions Panel */}
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-150 rounded-2xl shadow-xl z-[99] max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {suggestions.map((sug) => (
                          <button
                            key={sug.text}
                            type="button"
                            onClick={() => selectSuggestion(sug)}
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-start gap-2 transition-colors cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#6B8E4E] shrink-0 mt-0.5" />
                            <span>{sug.text}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* MAPA VECTORIAL SVG PREMIUM */}
                  <div className="border border-slate-150 bg-slate-900 rounded-3xl p-4 shadow-inner relative overflow-hidden flex flex-col justify-between select-none h-60">
                    
                    {/* Faux GPS Coordinates Overlay */}
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 text-[9px] font-mono text-emerald-400 font-bold z-10 flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 text-[#6B8E4E] animate-bounce" />
                      GPS: {mapCenter.lat.toFixed(5)}, {mapCenter.lng.toFixed(5)}
                    </div>

                    {/* Faux Location Label */}
                    <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 text-[9px] font-bold text-white z-10">
                      {selectedPresetLabel}
                    </div>

                    {/* Interactive Zoom Controls */}
                    <div className="absolute bottom-3 right-3 bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-white/5 z-10 flex flex-col gap-1">
                      <button 
                        type="button"
                        onClick={() => setMapZoom(prev => Math.min(prev + 0.2, 2))}
                        className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => setMapZoom(prev => Math.max(prev - 0.2, 0.6))}
                        className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                    </div>

                    {/* SVG MAP CANVAS */}
                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                      <svg 
                        viewBox="0 0 400 200" 
                        className="w-full h-full text-slate-800 transition-all duration-500 ease-out"
                        style={{ transform: `scale(${mapZoom})` }}
                      >
                        {/* Grid lines */}
                        <defs>
                          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        {/* Faux Blocks and Streets */}
                        <rect x="20" y="20" width="80" height="60" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />
                        <rect x="120" y="20" width="160" height="60" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />
                        <rect x="300" y="20" width="80" height="60" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />

                        <rect x="20" y="100" width="140" height="80" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />
                        <rect x="180" y="100" width="200" height="80" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />

                        {/* Simulated Parks or River */}
                        <path d="M -10 160 Q 100 130 200 160 T 410 160 L 410 210 L -10 210 Z" fill="rgba(107,142,78,0.12)" />

                        {/* Animated Geolocalization Pin (Center of Map) */}
                        <g transform="translate(200, 100)">
                          {/* Pulsing radar ripple */}
                          <circle cx="0" cy="0" r="15" fill="none" stroke="#6B8E4E" strokeWidth="2" className="animate-ping" style={{ transformOrigin: 'center' }} />
                          <circle cx="0" cy="0" r="28" fill="none" stroke="#6B8E4E" strokeWidth="1" className="opacity-30 animate-pulse" />
                          <circle cx="0" cy="0" r="4" fill="#6B8E4E" />

                          {/* Map Pin Indicator */}
                          <g transform="translate(-10, -25)">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#6B8E4E" className="animate-bounce" style={{ transform: 'scale(0.8)' }} />
                          </g>
                        </g>

                      </svg>
                    </div>

                    {/* Address Text inside Map */}
                    <div className="bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/5 text-[10px] text-slate-350 z-10 flex items-center gap-1.5 truncate shadow-lg">
                      <MapPin className="w-3.5 h-3.5 text-[#6B8E4E] shrink-0" />
                      <span className="truncate">{tenantAddress || 'Ninguna dirección especificada'}</span>
                    </div>

                  </div>

                </div>

              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1C2C35]/65 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#6B8E4E] hover:bg-[#6B8E4E]/90 text-white rounded-xl shadow-md hover:scale-[1.01] transition-all cursor-pointer"
                >
                  {editMode ? 'Guardar Cambios' : 'Registrar Escuela'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 5. CAJÓN LATERAL: GESTIÓN DE SEDES CONTEXTUAL (SÚPER CONSOLA) */}
      {isCampusDrawerOpen && drawerTenant && (
        <div className="fixed inset-0 bg-[#1C2C35]/40 backdrop-blur-sm z-[999] flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-slide-in relative border-l border-slate-100">
            
            {/* Cabecera Cajón */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#6B8E4E]" />
                <div>
                  <h3 className="text-base font-black text-slate-800">Sedes y Entornos Asignados</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Escuela: <strong className="text-slate-600">{drawerTenant.name}</strong></p>
                </div>
              </div>
              <button 
                onClick={() => setIsCampusDrawerOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado y Formulario */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Botón Nueva Sede en Cajón */}
              {!isCampusFormOpen ? (
                <button
                  onClick={() => {
                    setIsCampusFormOpen(true);
                    setCampusName('');
                    setCampusAddress('');
                    setCampusType('physical');
                    setCampusCapacity(100);
                  }}
                  className="w-full border-2 border-dashed border-[#6B8E4E]/30 hover:border-[#6B8E4E] bg-[#6B8E4E]/5 hover:bg-[#6B8E4E]/10 p-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-[#6B8E4E] transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Nuevo Entorno Académico (Sede / Aula)
                </button>
              ) : (
                /* Formulario Rápido */
                <form onSubmit={handleCampusSubmit} className="bg-slate-50 border border-slate-250 p-5 rounded-2xl space-y-4 animate-scale-up">
                  <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                    <span className="text-xs font-black text-[#1C2C35]">Registrar Entorno Curricular</span>
                    <button 
                      type="button" 
                      onClick={() => setIsCampusFormOpen(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-550">Nombre del Espacio</label>
                      <input 
                        type="text"
                        required
                        placeholder="ej: Sede Principal - Aula Magna"
                        value={campusName}
                        onChange={(e) => setCampusName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs bg-white focus:outline-none focus:border-[#6B8E4E] font-bold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-550">Tipo de Sede</label>
                      <select
                        value={campusType}
                        onChange={(e) => setCampusType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs bg-white focus:outline-none focus:border-[#6B8E4E] font-bold text-slate-800 cursor-pointer"
                      >
                        <option value="physical">Espacio Físico (Dirección)</option>
                        <option value="virtual">Espacio Virtual (LMS / URL)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-550">
                        {campusType === 'physical' ? 'Dirección de la Sede' : 'Enlace / Zoom URL'}
                      </label>
                      <input 
                        type="text"
                        required
                        placeholder={campusType === 'physical' ? 'ej: Av. Salaverry 2800' : 'ej: https://zoom.us/j/123'}
                        value={campusAddress}
                        onChange={(e) => setCampusAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs bg-white focus:outline-none focus:border-[#6B8E4E] font-bold text-slate-800"
                      />
                    </div>

                    <div className="col-span-1 space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-550">Aforo Académico</label>
                      <input 
                        type="number"
                        min={5}
                        required
                        value={campusCapacity}
                        onChange={(e) => setCampusCapacity(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs bg-white focus:outline-none focus:border-[#6B8E4E] font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setIsCampusFormOpen(false)}
                      className="px-3.5 py-2 bg-slate-200 text-slate-650 rounded-lg hover:bg-slate-250 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#6B8E4E] text-white rounded-lg hover:bg-[#6B8E4E]/90 cursor-pointer"
                    >
                      Guardar Espacio
                    </button>
                  </div>
                </form>
              )}

              {/* Listado de Sedes */}
              <div className="space-y-4">
                <span className="text-xs font-black text-slate-700 block">Listado de Sedes Actuales</span>
                
                {loadingCampuses ? (
                  <div className="py-8 text-center text-xs text-slate-450 font-bold flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#6B8E4E]" />
                    Sincronizando infraestructuras...
                  </div>
                ) : campusesList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl">
                    Esta escuela no cuenta con entornos académicos registrados.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-inner">
                    {campusesList.map((camp) => (
                      <div key={camp.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                            {camp.type === 'physical' ? (
                              <MapPin className="w-4.5 h-4.5 text-[#6B8E4E]" />
                            ) : (
                              <LinkIcon className="w-4.5 h-4.5 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 text-xs block">{camp.name}</span>
                            <span className="text-[10px] text-slate-450 truncate max-w-xs block font-medium mt-0.5">{camp.address}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Aforo Badge */}
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-150 px-2 py-0.5 rounded-full shrink-0">
                            Cap: {camp.capacity} alumnos
                          </span>

                          {/* Status and Toggle */}
                          <div className="flex gap-1">
                            {camp.status !== 'active' && (
                              <button 
                                onClick={() => handleCampusStatusToggle(camp, 'active')}
                                title="Marcar Operativo"
                                className="p-1 hover:bg-slate-100 rounded text-green-600 cursor-pointer border border-slate-150"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {camp.status !== 'maintenance' && (
                              <button 
                                onClick={() => handleCampusStatusToggle(camp, 'maintenance')}
                                title="Mantenimiento"
                                className="p-1 hover:bg-slate-100 rounded text-amber-600 cursor-pointer border border-slate-150"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {camp.status !== 'closed' && (
                              <button 
                                onClick={() => handleCampusStatusToggle(camp, 'closed')}
                                title="Inactivo"
                                className="p-1 hover:bg-slate-100 rounded text-red-500 cursor-pointer border border-slate-150"
                              >
                                <XSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>

            {/* Footer Cajón */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setIsCampusDrawerOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
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
