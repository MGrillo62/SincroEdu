'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from '@/components/shared/Sidebar';
import Header from '@/components/shared/Header';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Ejecutar verificación de autenticación al montar
  useEffect(() => {
    setMounted(true);
    const verify = async () => {
      await checkAuth();
    };
    verify();
  }, [checkAuth]);

  // Si aún no está montado en el cliente o está cargando la sesión, mostrar pantalla de carga premium
  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  if (!mounted || (isLoading && !isAuthenticated)) {
    return (
      <div className="min-h-screen bg-[#FAFBF9] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#6B8E4E]" />
        <p className="text-sm font-semibold text-[#1C2C35]/60 tracking-wide animate-pulse">
          Validando credenciales seguras...
        </p>
      </div>
    );
  }

  // Si no está autenticado tras la carga, evitar el parpadeo del contenido antes de redirigir
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-[#FAFBF9] overflow-hidden font-sans">
      
      {/* 1. BARRA LATERAL MULTI-TENANT DINÁMICA */}
      <Sidebar />

      {/* 2. ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Cabecera Principal (Perfil y Dropdown) */}
        <Header />

        {/* Cuerpo del Dashboard con Scroll independiente */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#FAFBF9]">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>

      </div>

    </div>
  );
}
