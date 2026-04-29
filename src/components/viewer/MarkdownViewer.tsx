"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Document } from "@/types";
import { updateDocument } from "@/lib/db/operations";
import { db } from "@/lib/db/schema";
import { TextAnnotator } from "@/components/editor/TextAnnotator";

export function MarkdownViewer({ document: doc }: { document: Document }) {
  const [mode, setMode] = useState<"read" | "code" | "edit">("read");
  const [copied, setCopied] = useState(false);
  const [editContent, setEditContent] = useState(doc.content);
  const [saving, setSaving] = useState(false);

  if (!doc.content && mode !== "edit") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-stone-400">No content</p>
      </div>
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      // Check if codings exist on this document
      const codingCount = await db.codings
        .where("documentId")
        .equals(doc.id)
        .filter((c) => c.deletedAt === null)
        .count();

      if (codingCount > 0) {
        const ok = confirm(
          `This document has ${codingCount} coded highlight(s). ` +
          `Editing the text will invalidate their character offsets. ` +
          `Existing highlights will be removed. Continue?`
        );
        if (!ok) {
          setSaving(false);
          return;
        }
        // Clear codings since offsets are now invalid
        const now = new Date();
        await db.codings
          .where("documentId")
          .equals(doc.id)
          .modify({ deletedAt: now, updatedAt: now, _dirty: true });
      }

      await updateDocument(doc.id, { content: editContent });
      setMode("read");
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit() {
    setEditContent(doc.content);
    setMode("edit");
  }

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100">
        <div className="flex gap-1">
          {(["read", "code", "edit"] as const).map((m) => (
            <button
              key={m}
              onClick={() => m === "edit" ? handleStartEdit() : setMode(m)}
              className={`rounded px-2.5 py-1 text-xs capitalize ${
                mode === m
                  ? "bg-stone-100 text-stone-900 font-medium"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="rounded px-2.5 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50"
        >
          {copied ? "Copied" : "Copy all"}
        </button>
      </div>

      {mode === "read" && (
        <div className="font-serif text-stone-900 leading-relaxed prose prose-stone prose-sm max-w-none">
          <div className="not-prose mb-3 flex items-center gap-2 rounded bg-stone-50 px-3 py-1.5 text-[11px] text-stone-500">
            <span>Switch to</span>
            <button
              onClick={() => setMode("code")}
              className="font-medium text-stone-700 underline"
            >
              Code mode
            </button>
            <span>to highlight and tag text</span>
          </div>
          <ReactMarkdown>{doc.content}</ReactMarkdown>
          {doc.translationContent && (
            <div className="mt-6 pt-4 border-t border-stone-100">
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2 not-prose">
                Translation
              </p>
              <div className="italic text-stone-500 text-sm">
                <ReactMarkdown>{doc.translationContent}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "code" && (
        <div className="font-serif text-stone-900 leading-relaxed">
          <TextAnnotator document={doc} />
          {doc.translationContent && (
            <div className="mt-6 pt-4 border-t border-stone-100">
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2">
                Translation
              </p>
              <div className="italic text-stone-500 text-sm">
                <TextAnnotator document={doc} isTranslation />
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="space-y-3">
          <p className="text-[11px] text-stone-500">
            Edit the raw markdown content. Changes will be saved when you click Save.
          </p>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[400px] rounded-md border border-stone-200 bg-white px-4 py-3 font-mono text-sm text-stone-800 leading-relaxed focus:border-stone-400 focus:outline-none resize-y"
            spellCheck={false}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMode("read")}
              className="rounded px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || editContent === doc.content}
              className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
