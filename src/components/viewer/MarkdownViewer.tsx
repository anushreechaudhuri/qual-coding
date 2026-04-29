"use client";

import type { Document } from "@/types";

/**
 * Renders a document's canonical content as plain text with a serif font.
 *
 * IMPORTANT (character offset invariant): This component renders the stored
 * content string byte-for-byte. It must NOT normalize whitespace, strip
 * characters, or transform the content in any way. Character offsets in
 * codings reference this exact string, and any modification would break
 * every existing coding on this document.
 *
 * If translationContent exists, it appears in italics below the original.
 * For audio documents with segments, use SegmentList instead.
 */
export function MarkdownViewer({ document: doc }: { document: Document }) {
  if (!doc.content) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-stone-400">No content</p>
      </div>
    );
  }

  // For documents with segments (audio transcriptions), render via SegmentList.
  // This component handles flat text documents (PDFs, text files).
  const paragraphs = doc.content.split("\n\n");
  const translationParagraphs = doc.translationContent?.split("\n\n") ?? [];

  return (
    <div
      className="px-6 py-4 max-w-2xl mx-auto font-serif text-stone-900 leading-relaxed"
      data-content-container
    >
      {paragraphs.map((para, i) => (
        <div key={i} className="mb-4">
          <p className="whitespace-pre-wrap">{para}</p>
          {translationParagraphs[i] && (
            <p className="mt-1 whitespace-pre-wrap italic text-stone-500 text-sm">
              {translationParagraphs[i]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
