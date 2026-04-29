"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Document } from "@/types";
import { TextAnnotator } from "@/components/editor/TextAnnotator";

/**
 * Renders document content with a toggle between reading mode (rendered
 * markdown) and coding mode (raw text with highlight support).
 *
 * Reading mode uses react-markdown for proper formatting of headers,
 * tables, lists, etc. from Reducto output.
 *
 * Coding mode renders raw text byte-for-byte (character offset invariant)
 * with text selection and code application via TextAnnotator.
 */
export function MarkdownViewer({ document: doc }: { document: Document }) {
  const [mode, setMode] = useState<"read" | "code">("read");
  const [copied, setCopied] = useState(false);

  if (!doc.content) {
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

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100">
        <div className="flex gap-1">
          <button
            onClick={() => setMode("read")}
            className={`rounded px-2.5 py-1 text-xs ${
              mode === "read"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Read
          </button>
          <button
            onClick={() => setMode("code")}
            className={`rounded px-2.5 py-1 text-xs ${
              mode === "code"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Code
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="rounded px-2.5 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50"
        >
          {copied ? "Copied" : "Copy all"}
        </button>
      </div>

      {mode === "read" ? (
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
      ) : (
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
    </div>
  );
}
