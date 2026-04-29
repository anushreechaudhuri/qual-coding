/**
 * Zustand store for ephemeral UI state.
 *
 * This store holds state that does NOT need to persist across sessions
 * or sync to Drive. Things like which panel is visible, what document
 * is selected, or the current text selection range.
 *
 * All persisted data (projects, documents, codes, codings, memos) lives
 * in Dexie/IndexedDB and is accessed via useLiveQuery hooks instead.
 */

import { create } from "zustand";

export interface SelectionRange {
  startOffset: number;
  endOffset: number;
  text: string;
  isTranslation: boolean;
}

interface UiState {
  // Navigation
  currentProjectId: string | null;
  currentDocumentId: string | null;
  selectedCodingId: string | null;

  // Panel visibility
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;

  // Text selection (active highlight in the editor)
  selectionRange: SelectionRange | null;

  // Modal state
  activeModal:
    | "upload"
    | "createProject"
    | "createCode"
    | "mergeCode"
    | "codebookImport"
    | "export"
    | "settings"
    | "deleteConfirm"
    | null;

  // Actions
  setCurrentProject: (id: string | null) => void;
  setCurrentDocument: (id: string | null) => void;
  setSelectedCoding: (id: string | null) => void;
  setSelectionRange: (range: SelectionRange | null) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  openModal: (modal: UiState["activeModal"]) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentProjectId: null,
  currentDocumentId: null,
  selectedCodingId: null,
  leftPanelVisible: true,
  rightPanelVisible: true,
  selectionRange: null,
  activeModal: null,

  setCurrentProject: (id) =>
    set({ currentProjectId: id, currentDocumentId: null, selectedCodingId: null }),
  setCurrentDocument: (id) => set({ currentDocumentId: id, selectedCodingId: null }),
  setSelectedCoding: (id) => set({ selectedCodingId: id }),
  setSelectionRange: (range) => set({ selectionRange: range }),
  toggleLeftPanel: () => set((s) => ({ leftPanelVisible: !s.leftPanelVisible })),
  toggleRightPanel: () => set((s) => ({ rightPanelVisible: !s.rightPanelVisible })),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));
