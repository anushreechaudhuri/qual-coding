"use client";

import type { Document } from "@/types";
import { TextAnnotator } from "@/components/editor/TextAnnotator";

/**
 * Renders a document's canonical content with coding support.
 *
 * IMPORTANT (character offset invariant): This component renders the stored
 * content string byte-for-byte. It must NOT normalize whitespace, strip
 * characters, or transform the content in any way. Character offsets in
 * codings reference this exact string, and any modification would break
 * every existing coding on this document.
 *
 * Text selection triggers the CodePicker dropdown for applying codes.
 * Existing codings render as colored highlights.
 */
export function MarkdownViewer({ document: doc }: { document: Document }) {
  if (!doc.content) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-stone-400">No content</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto font-serif text-stone-900 leading-relaxed">
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
  );
}
