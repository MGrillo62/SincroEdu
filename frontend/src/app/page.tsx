'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      // Si la sesión es válida redirigir al Dashboard, de lo contrario al Login
      if (localStorage.getItem('sincroedu_token')) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    };
    init();
  }, [router, checkAuth]);

  return (
    <div className="min-h-screen bg-[#FAFBF9] flex flex-col items-center justify-center gap-4 font-sans">
      <Loader2 className="w-10 h-10 animate-spin text-[#6B8E4E]" />
      <p className="text-sm font-semibold text-[#1C2C35]/60 tracking-wide animate-pulse">
        Estableciendo conexión institucional segura...
      </p>
    </div>
  );
}
