"use client";

import { useState } from "react";
import type { Document } from "@/types";
import { TextAnnotator } from "@/components/editor/TextAnnotator";

type ViewMode = "interleaved" | "original" | "translation" | "side-by-side";

/**
 * Transcript viewer for audio documents. Shows original and translation
 * text with multiple view modes and coding support on both tracks.
 *
 * Coding on the original creates a linked coding on the translation
 * (and vice versa) via the bilingual span linker.
 */
export function TranscriptView({ document: doc }: { document: Document }) {
  const [viewMode, setViewMode] = useState<ViewMode>("interleaved");

  const hasTranslation = !!doc.translationContent;

  return (
    <div>
      {/* View mode toggle */}
      {hasTranslation && (
        <div className="flex items-center gap-1 px-6 py-2 border-b border-stone-100">
          {(
            [
              { mode: "interleaved" as const, label: "Interleaved" },
              { mode: "original" as const, label: "Original" },
              { mode: "translation" as const, label: "Translation" },
              { mode: "side-by-side" as const, label: "Side by side" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded px-2 py-0.5 text-[11px] ${
                viewMode === mode
                  ? "bg-stone-100 text-stone-900 font-medium"
                  : "text-stone-400 hover:text-stone-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-4 max-w-3xl mx-auto font-serif text-stone-900 leading-relaxed">
        {viewMode === "interleaved" && (
          <InterleavedView document={doc} />
        )}
        {viewMode === "original" && (
          <TextAnnotator document={doc} />
        )}
        {viewMode === "translation" && doc.translationContent && (
          <TextAnnotator document={doc} isTranslation />
        )}
        {viewMode === "side-by-side" && (
          <SideBySideView document={doc} />
        )}
        {!hasTranslation && viewMode !== "original" && (
          <TextAnnotator document={doc} />
        )}
      </div>
    </div>
  );
}

/**
 * Interleaved view: each segment shows original text followed by
 * translation in italics. Both are codable.
 */
function InterleavedView({ document: doc }: { document: Document }) {
  if (doc.segments.length === 0) {
    return <TextAnnotator document={doc} />;
  }

  return (
    <div className="space-y-4" data-content-container>
      {doc.segments.map((segment) => (
        <div key={segment.index} className="group">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-xs font-medium text-stone-500 font-sans">
              {segment.speaker}
            </span>
            <span className="text-[11px] text-stone-400 font-sans">
              {segment.timestamp}
            </span>
          </div>
          <p className="whitespace-pre-wrap">{segment.content}</p>
          {segment.translation && segment.translation !== segment.content && (
            <p className="mt-0.5 text-sm italic text-stone-500 whitespace-pre-wrap">
              {segment.translation}
            </p>
          )}
        </div>
      ))}

      {/* Hidden TextAnnotators for coding support */}
      <div className="sr-only">
        <TextAnnotator document={doc} />
        {doc.translationContent && <TextAnnotator document={doc} isTranslation />}
      </div>
    </div>
  );
}

/**
 * Side-by-side view: original on the left, translation on the right.
 * Both columns are independently codable.
 */
function SideBySideView({ document: doc }: { document: Document }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2">
          Original
        </p>
        <TextAnnotator document={doc} />
      </div>
      {doc.translationContent && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2">
            Translation
          </p>
          <div className="text-sm text-stone-600">
            <TextAnnotator document={doc} isTranslation />
          </div>
        </div>
      )}
    </div>
  );
}
