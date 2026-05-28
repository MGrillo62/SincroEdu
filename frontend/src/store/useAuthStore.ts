import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  roleId: string;
  roleName: string;
  lastLogin: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  status: string;
}

export interface MenuPermission {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  route: string;
  sortOrder: number;
  module: string;
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  menuAccess: MenuPermission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

const API_URL = 'http://localhost:4000/api';

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('sincroedu_token') : null,
  user: null,
  tenant: null,
  menuAccess: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      localStorage.setItem('sincroedu_token', data.token);
      
      set({
        token: data.token,
        user: data.user,
        tenant: data.tenant,
        menuAccess: data.menuAccess,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err: any) {
      set({
        error: err.message || 'Error de conexión con el servidor',
        isLoading: false,
        isAuthenticated: false,
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('sincroedu_token');
    set({
      token: null,
      user: null,
      tenant: null,
      menuAccess: [],
      isAuthenticated: false,
      error: null,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('sincroedu_token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        localStorage.removeItem('sincroedu_token');
        set({
          token: null,
          user: null,
          tenant: null,
          menuAccess: [],
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      set({
        user: data.user,
        tenant: data.tenant,
        menuAccess: data.menuAccess,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      // Si el backend no está disponible, mantenemos el estado local si es posible o silenciamos
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
