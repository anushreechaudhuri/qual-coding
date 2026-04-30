"use client";

import { useState } from "react";
import type { Document } from "@/types";
import { TextAnnotator } from "@/components/editor/TextAnnotator";
import { CopyDropdown } from "./CopyDropdown";

type ViewMode = "original" | "translation" | "side-by-side";

/**
 * Transcript viewer for audio documents. Coding works on both original
 * and translation tracks. Three view modes for different workflows.
 */
export function TranscriptView({ document: doc }: { document: Document }) {
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const hasTranslation = !!doc.translationContent;

  return (
    <div>
      {/* View mode toggle + copy */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-stone-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("original")}
            className={`rounded px-2 py-0.5 text-[11px] ${
              viewMode === "original"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Original
          </button>
          {hasTranslation && (
            <>
              <button
                onClick={() => setViewMode("translation")}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  viewMode === "translation"
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                Translation
              </button>
              <button
                onClick={() => setViewMode("side-by-side")}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  viewMode === "side-by-side"
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                Side by side
              </button>
            </>
          )}
        </div>
        <CopyDropdown document={doc} />
      </div>

      {/* Content */}
      {viewMode === "original" && (
        <div className="px-6 py-4 max-w-2xl mx-auto font-serif text-stone-900 leading-relaxed">
          <TextAnnotator document={doc} />
          {hasTranslation && (
            <p className="mt-4 text-[10px] text-stone-400 font-sans">
              Switch to Translation or Side by side to code the English text
            </p>
          )}
        </div>
      )}

      {viewMode === "translation" && hasTranslation && (
        <div className="px-6 py-4 max-w-2xl mx-auto font-serif text-stone-600 leading-relaxed">
          <TextAnnotator document={doc} isTranslation />
        </div>
      )}

      {viewMode === "side-by-side" && (
        <div className="grid grid-cols-2 gap-0 divide-x divide-stone-100">
          <div className="px-4 py-4 font-serif text-stone-900 leading-relaxed">
            <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2">
              Original
            </p>
            <TextAnnotator document={doc} />
          </div>
          {hasTranslation && (
            <div className="px-4 py-4 font-serif text-stone-600 leading-relaxed text-sm">
              <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2">
                Translation
              </p>
              <TextAnnotator document={doc} isTranslation />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
