import { create } from "zustand";

type PipelineView = "table" | "kanban";

interface UIState {
  pipelineView: PipelineView;
  setPipelineView: (view: PipelineView) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  pipelineView: "table",
  setPipelineView: (view) => set({ pipelineView: view }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
