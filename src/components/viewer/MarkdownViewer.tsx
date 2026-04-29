"use client";

import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import dynamic from "next/dynamic";
import type { Document } from "@/types";
import { updateDocument } from "@/lib/db/operations";

const ContentEditor = dynamic(
  () => import("./ContentEditor").then((m) => ({ default: m.ContentEditor })),
  { ssr: false, loading: () => <p className="text-xs text-stone-400 p-4">Loading editor...</p> }
);
import { adjustCodingOffsets } from "@/lib/coding/offsetAdjuster";
import { useUndoStore } from "@/lib/stores/undoStore";
import { TextAnnotator } from "@/components/editor/TextAnnotator";

/**
 * Three modes:
 * - Read: rendered markdown (headers, lists, tables)
 * - Code: raw text with highlight-based coding + inline editing
 * - The Code view has an Edit toggle that makes text editable. Saving
 *   adjusts all coding offsets automatically.
 */
export function MarkdownViewer({ document: doc }: { document: Document }) {
  const [mode, setMode] = useState<"read" | "code">("read");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(doc.content);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoStore();

  // Sync editContent when document changes externally
  useEffect(() => {
    if (!editing) setEditContent(doc.content);
  }, [doc.content, editing]);

  async function handleCopy() {
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveEdit() {
    if (editContent === doc.content) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      // Push current content to undo stack before saving
      pushUndo(doc.id, doc.content);

      // Adjust coding offsets based on the diff
      const result = await adjustCodingOffsets(doc.id, doc.content, editContent);

      await updateDocument(doc.id, { content: editContent });

      const parts: string[] = [];
      if (result.updated > 0) parts.push(`${result.updated} highlights adjusted`);
      if (result.removed > 0) parts.push(`${result.removed} removed`);
      setSaveResult(parts.length > 0 ? parts.join(", ") : "Saved");
      setTimeout(() => setSaveResult(null), 3000);

      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const handleUndo = useCallback(async () => {
    const snapshot = undo(doc.id);
    if (!snapshot) return;

    // Save current content for redo, then restore snapshot
    const currentContent = doc.content;
    await adjustCodingOffsets(doc.id, currentContent, snapshot.content);
    await updateDocument(doc.id, { content: snapshot.content });
    setEditContent(snapshot.content);
  }, [doc.id, doc.content, undo]);

  const handleRedo = useCallback(async () => {
    const snapshot = redo(doc.id);
    if (!snapshot) return;

    const currentContent = doc.content;
    await adjustCodingOffsets(doc.id, currentContent, snapshot.content);
    await updateDocument(doc.id, { content: snapshot.content });
    setEditContent(snapshot.content);
  }, [doc.id, doc.content, redo]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        if (canUndo(doc.id)) {
          e.preventDefault();
          handleUndo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        if (canRedo(doc.id)) {
          e.preventDefault();
          handleRedo();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [doc.id, canUndo, canRedo, handleUndo, handleRedo]);

  if (!doc.content && !editing) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-stone-400">No content</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setMode("read"); setEditing(false); }}
            className={`rounded px-2.5 py-1 text-xs ${
              mode === "read" ? "bg-stone-100 text-stone-900 font-medium" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Read
          </button>
          <button
            onClick={() => { setMode("code"); setEditing(false); }}
            className={`rounded px-2.5 py-1 text-xs ${
              mode === "code" && !editing ? "bg-stone-100 text-stone-900 font-medium" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Code
          </button>
          {mode === "code" && (
            <>
              <span className="text-stone-200 mx-0.5">|</span>
              <button
                onClick={() => {
                  if (editing) {
                    handleSaveEdit();
                  } else {
                    setEditContent(doc.content);
                    setEditing(true);
                  }
                }}
                className={`rounded px-2.5 py-1 text-xs ${
                  editing ? "bg-amber-100 text-amber-800 font-medium" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {editing ? (saving ? "Saving..." : "Save edit") : "Edit"}
              </button>
              {editing && (
                <button
                  onClick={() => { setEditContent(doc.content); setEditing(false); }}
                  className="rounded px-2 py-1 text-xs text-stone-400 hover:text-stone-600"
                >
                  Cancel
                </button>
              )}
            </>
          )}

          {/* Undo/Redo */}
          {mode === "code" && (
            <>
              <span className="text-stone-200 mx-0.5">|</span>
              <button
                onClick={handleUndo}
                disabled={!canUndo(doc.id)}
                className="rounded px-1.5 py-1 text-xs text-stone-400 hover:text-stone-600 disabled:opacity-30"
                title="Undo (Cmd+Z)"
              >
                ↩
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo(doc.id)}
                className="rounded px-1.5 py-1 text-xs text-stone-400 hover:text-stone-600 disabled:opacity-30"
                title="Redo (Cmd+Shift+Z)"
              >
                ↪
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveResult && (
            <span className="text-[10px] text-green-600">{saveResult}</span>
          )}
          <button
            onClick={handleCopy}
            className="rounded px-2.5 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50"
          >
            {copied ? "Copied" : "Copy all"}
          </button>
        </div>
      </div>

      {/* Read mode */}
      {mode === "read" && (
        <div className="font-serif text-stone-900 leading-relaxed prose prose-stone prose-sm max-w-none">
          <div className="not-prose mb-3 flex items-center gap-2 rounded bg-stone-50 px-3 py-1.5 text-[11px] text-stone-500">
            <span>Switch to</span>
            <button onClick={() => setMode("code")} className="font-medium text-stone-700 underline">Code mode</button>
            <span>to highlight, tag, or edit text</span>
          </div>
          <ReactMarkdown>{doc.content}</ReactMarkdown>
          {doc.translationContent && (
            <div className="mt-6 pt-4 border-t border-stone-100">
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2 not-prose">Translation</p>
              <div className="italic text-stone-500 text-sm">
                <ReactMarkdown>{doc.translationContent}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code mode: highlights + optional inline editing */}
      {mode === "code" && !editing && (
        <div className="font-serif text-stone-900 leading-relaxed">
          <TextAnnotator document={doc} />
          {doc.translationContent && (
            <div className="mt-6 pt-4 border-t border-stone-100">
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2">Translation</p>
              <div className="italic text-stone-500 text-sm">
                <TextAnnotator document={doc} isTranslation />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code mode: WYSIWYG editing */}
      {mode === "code" && editing && (
        <div>
          <p className="text-[10px] text-stone-500 mb-2">
            Editing with live formatting. Highlights auto-adjust on save. Deleted text removes its highlights.
          </p>
          <ContentEditor
            content={editContent}
            onChange={setEditContent}
          />
        </div>
      )}
    </div>
  );
}
