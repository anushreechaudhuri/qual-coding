/**
 * Undo/redo history for document content edits.
 * Stores up to 10 snapshots per document. Each snapshot captures
 * the content string before an edit so it can be restored.
 */

import { create } from "zustand";

interface UndoSnapshot {
  content: string;
  timestamp: number;
}

interface UndoState {
  history: Map<string, UndoSnapshot[]>;
  redoStack: Map<string, UndoSnapshot[]>;

  pushUndo: (documentId: string, content: string) => void;
  undo: (documentId: string) => UndoSnapshot | null;
  redo: (documentId: string) => UndoSnapshot | null;
  canUndo: (documentId: string) => boolean;
  canRedo: (documentId: string) => boolean;
}

const MAX_UNDO = 10;

export const useUndoStore = create<UndoState>((set, get) => ({
  history: new Map(),
  redoStack: new Map(),

  pushUndo: (documentId, content) =>
    set((state) => {
      const history = new Map(state.history);
      const existing = history.get(documentId) ?? [];
      const updated = [...existing, { content, timestamp: Date.now() }].slice(-MAX_UNDO);
      history.set(documentId, updated);

      // Clear redo stack on new edit
      const redoStack = new Map(state.redoStack);
      redoStack.delete(documentId);

      return { history, redoStack };
    }),

  undo: (documentId) => {
    const state = get();
    const stack = state.history.get(documentId);
    if (!stack || stack.length === 0) return null;

    const snapshot = stack[stack.length - 1];

    set((s) => {
      const history = new Map(s.history);
      history.set(documentId, stack.slice(0, -1));

      const redoStack = new Map(s.redoStack);
      const existing = redoStack.get(documentId) ?? [];
      redoStack.set(documentId, [...existing, snapshot]);

      return { history, redoStack };
    });

    return snapshot;
  },

  redo: (documentId) => {
    const state = get();
    const stack = state.redoStack.get(documentId);
    if (!stack || stack.length === 0) return null;

    const snapshot = stack[stack.length - 1];

    set((s) => {
      const redoStack = new Map(s.redoStack);
      redoStack.set(documentId, stack.slice(0, -1));

      const history = new Map(s.history);
      const existing = history.get(documentId) ?? [];
      history.set(documentId, [...existing, snapshot]);

      return { history, redoStack };
    });

    return snapshot;
  },

  canUndo: (documentId) => {
    const stack = get().history.get(documentId);
    return !!stack && stack.length > 0;
  },

  canRedo: (documentId) => {
    const stack = get().redoStack.get(documentId);
    return !!stack && stack.length > 0;
  },
}));
