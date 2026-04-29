"use client";

import { useRef, useCallback, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { selectionToOffsets } from "@/lib/coding/offsetUtils";
import { deleteCoding } from "@/lib/db/operations";
import { useCodebook } from "@/hooks/useCodebook";
import { useCodingActions } from "@/hooks/useCodingActions";
import { HighlightLayer } from "./HighlightLayer";
import { CodePicker } from "./CodePicker";
import type { Document, Code, Coding } from "@/types";

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
  const [hoveredCoding, setHoveredCoding] = useState<{
    coding: Coding;
    code: Code | undefined;
    rect: DOMRect;
  } | null>(null);

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

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Ignore clicks on the tooltip
    if ((e.target as HTMLElement).closest("[data-coding-tooltip]")) return;

    const selection = window.getSelection();
    if (!selection || !containerRef.current) return;

    const offsets = selectionToOffsets(selection, containerRef.current);
    if (!offsets) {
      // Clicked without selecting: clear pending
      setPendingSelection(null);
      setPickerPosition(null);
      return;
    }

    // Ignore accidental select-all (more than 80% of content)
    if (content && offsets.endOffset - offsets.startOffset > content.length * 0.8) {
      window.getSelection()?.removeAllRanges();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setPendingSelection(offsets);
    setPickerPosition({
      x: Math.min(rect.left, window.innerWidth - 220),
      y: rect.bottom + 4,
    });
    setHoveredCoding(null);
  }, [content]);

  const handleCodeSelect = useCallback(
    async (selectedCodeIds: string[]) => {
      if (!pendingSelection || selectedCodeIds.length === 0) return;

      for (const codeId of selectedCodeIds) {
        await applyCoding({
          codeId,
          startOffset: pendingSelection.startOffset,
          endOffset: pendingSelection.endOffset,
          quotedText: pendingSelection.text,
          isTranslation: isTranslation ?? false,
        });
      }

      setRecentCodeIds((prev) => {
        const filtered = prev.filter((id) => !selectedCodeIds.includes(id));
        return [...selectedCodeIds, ...filtered].slice(0, 5);
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

  const handleCodingClick = useCallback(
    (codingId: string, event: React.MouseEvent) => {
      const coding = (codings ?? []).find((c) => c.id === codingId);
      if (!coding) return;
      const code = codeMap.get(coding.codeId);
      setHoveredCoding({
        coding,
        code,
        rect: (event.target as HTMLElement).getBoundingClientRect(),
      });
    },
    [codings, codeMap]
  );

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

      {/* Code picker (multi-select) */}
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

      {/* Coding detail tooltip */}
      {hoveredCoding && (
        <CodingTooltip
          coding={hoveredCoding.coding}
          code={hoveredCoding.code}
          allCodings={(codings ?? []).filter(
            (c) =>
              c.startOffset === hoveredCoding.coding.startOffset &&
              c.endOffset === hoveredCoding.coding.endOffset
          )}
          codeMap={codeMap}
          rect={hoveredCoding.rect}
          onDelete={async (id) => {
            await deleteCoding(id);
            setHoveredCoding(null);
          }}
          onClose={() => setHoveredCoding(null)}
        />
      )}
    </>
  );
}

function CodingTooltip({
  coding,
  code,
  allCodings,
  codeMap,
  rect,
  onDelete,
  onClose,
}: {
  coding: Coding;
  code: Code | undefined;
  allCodings: Coding[];
  codeMap: Map<string, Code>;
  rect: DOMRect;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        data-coding-tooltip
        className="fixed z-50 w-52 rounded-md border border-stone-200 bg-white p-2 shadow-lg"
        style={{
          left: Math.min(rect.left, window.innerWidth - 220),
          top: rect.bottom + 4,
        }}
      >
        <div className="text-[10px] text-stone-400 mb-1">
          Applied codes ({allCodings.length}):
        </div>
        <div className="space-y-1">
          {allCodings.map((c) => {
            const codeObj = codeMap.get(c.codeId);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded px-1.5 py-1 hover:bg-stone-50"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: codeObj?.color ?? "#78716c" }}
                  />
                  <span className="text-xs text-stone-700">
                    {codeObj?.name ?? "Unknown"}
                  </span>
                </div>
                <button
                  onClick={() => onDelete(c.id)}
                  className="text-[10px] text-stone-400 hover:text-red-500"
                >
                  remove
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-stone-100">
          <p className="text-[10px] text-stone-400 line-clamp-2">
            &ldquo;{coding.quotedText}&rdquo;
          </p>
        </div>
      </div>
    </>
  );
}
