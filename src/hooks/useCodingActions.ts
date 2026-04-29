"use client";

import { useCallback } from "react";
import { createCoding, deleteCoding } from "@/lib/db/operations";
import { findCoveredSegments, getLinkedTranslationRange } from "@/lib/coding/spanLinker";
import type { Document, AudioSegment } from "@/types";

/**
 * Hook providing actions for creating and deleting codings.
 * Handles bilingual span linking for audio documents with translation tracks.
 */
export function useCodingActions(document: Document | null) {
  const applyCoding = useCallback(
    async (params: {
      codeId: string;
      startOffset: number;
      endOffset: number;
      quotedText: string;
      isTranslation: boolean;
    }) => {
      if (!document) return;

      const coding = await createCoding({
        projectId: document.projectId,
        documentId: document.id,
        codeId: params.codeId,
        startOffset: params.startOffset,
        endOffset: params.endOffset,
        isTranslation: params.isTranslation,
        linkedCodingId: null,
        quotedText: params.quotedText,
      });

      // For audio documents with translation, create a linked coding
      if (
        document.segments.length > 0 &&
        document.translationContent &&
        !params.isTranslation
      ) {
        const coveredIndices = findCoveredSegments(
          params.startOffset,
          params.endOffset,
          document.segments,
          document.content
        );

        const linkedRange = getLinkedTranslationRange(
          coveredIndices,
          document.segments,
          document.translationContent
        );

        if (linkedRange) {
          const linkedCoding = await createCoding({
            projectId: document.projectId,
            documentId: document.id,
            codeId: params.codeId,
            startOffset: linkedRange.startOffset,
            endOffset: linkedRange.endOffset,
            isTranslation: true,
            linkedCodingId: coding.id,
            quotedText: linkedRange.text,
          });

          // Update the original coding with the linked ID
          const { db } = await import("@/lib/db/schema");
          await db.codings.update(coding.id, {
            linkedCodingId: linkedCoding.id,
          });
        }
      }

      return coding;
    },
    [document]
  );

  const removeCoding = useCallback(async (codingId: string) => {
    await deleteCoding(codingId);
  }, []);

  return { applyCoding, removeCoding };
}
