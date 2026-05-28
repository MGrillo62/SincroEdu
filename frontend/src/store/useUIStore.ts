import { create } from 'zustand';

interface UIState {
  isSidebarExpanded: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setSidebarWidth: (width: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarExpanded: true,
  sidebarWidth: 260,
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
}));

