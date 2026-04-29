"use client";

import { useRef, useCallback, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { selectionToOffsets } from "@/lib/coding/offsetUtils";
import { useCodebook } from "@/hooks/useCodebook";
import { useCodingActions } from "@/hooks/useCodingActions";
import { HighlightLayer } from "./HighlightLayer";
import { CodePicker } from "./CodePicker";
import type { Document, Code } from "@/types";

/**
 * Wraps document content to enable text selection and code application.
 * On mouseup after selecting text, shows a temporary highlight and opens
 * the CodePicker dropdown. The pending selection stays visible until the
 * user picks a code or dismisses the picker.
 */
export function TextAnnotator({
  document: doc,
  isTranslation,
}: {
  document: Document;
  isTranslation?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pickerPosition, setPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    startOffset: number;
    endOffset: number;
    text: string;
  } | null>(null);
  const [recentCodeIds, setRecentCodeIds] = useState<string[]>([]);

  const codes = useCodebook(doc.projectId);
  const { applyCoding } = useCodingActions(doc);

  const content = isTranslation ? doc.translationContent : doc.content;

  const codings = useLiveQuery(
    () =>
      db.codings
        .where("documentId")
        .equals(doc.id)
        .filter(
          (c) =>
            c.deletedAt === null &&
            c.isTranslation === (isTranslation ?? false)
        )
        .toArray(),
    [doc.id, isTranslation]
  );

  const codeMap = new Map<string, Code>();
  for (const code of codes ?? []) {
    codeMap.set(code.id, code);
  }

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !containerRef.current) return;

    const offsets = selectionToOffsets(selection, containerRef.current);
    if (!offsets) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setPendingSelection(offsets);
    setPickerPosition({
      x: Math.min(rect.left, window.innerWidth - 240),
      y: rect.bottom + 4,
    });

    // Don't clear browser selection yet so the user sees what they selected
  }, []);

  const handleCodeSelect = useCallback(
    async (codeId: string) => {
      if (!pendingSelection) return;

      await applyCoding({
        codeId,
        startOffset: pendingSelection.startOffset,
        endOffset: pendingSelection.endOffset,
        quotedText: pendingSelection.text,
        isTranslation: isTranslation ?? false,
      });

      setRecentCodeIds((prev) => {
        const filtered = prev.filter((id) => id !== codeId);
        return [codeId, ...filtered].slice(0, 5);
      });

      window.getSelection()?.removeAllRanges();
      setPendingSelection(null);
      setPickerPosition(null);
    },
    [pendingSelection, applyCoding, isTranslation]
  );

  const dismissPicker = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);
    setPickerPosition(null);
  }, []);

  const handleCodingClick = useCallback((codingId: string) => {
    console.log("Coding clicked:", codingId);
  }, []);

  if (!content) return null;

  return (
    <>
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="whitespace-pre-wrap select-text"
        data-content-container
      >
        <HighlightLayer
          text={content}
          codings={codings ?? []}
          codeMap={codeMap}
          onCodingClick={handleCodingClick}
          pendingSelection={pendingSelection}
        />
      </div>

      {pickerPosition && codes.length > 0 && (
        <CodePicker
          codes={codes}
          recentCodeIds={recentCodeIds}
          onSelect={handleCodeSelect}
          onClose={dismissPicker}
          position={pickerPosition}
        />
      )}

      {pickerPosition && codes.length === 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={dismissPicker} />
          <div
            className="fixed z-50 rounded-md border border-stone-200 bg-white p-3 shadow-lg"
            style={{ left: pickerPosition.x, top: pickerPosition.y }}
          >
            <p className="text-xs text-stone-500">
              No codes yet. Create a code in the codebook panel first.
            </p>
          </div>
        </>
      )}
    </>
  );
}
