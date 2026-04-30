"use client";

import { useState, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import type { Document, Code } from "@/types";
import { TextAnnotator } from "@/components/editor/TextAnnotator";
import { CopyDropdown } from "./CopyDropdown";
import { useCodebook } from "@/hooks/useCodebook";
import { useCodingActions } from "@/hooks/useCodingActions";
import { CodePicker } from "@/components/editor/CodePicker";
import { HighlightLayer } from "@/components/editor/HighlightLayer";

type ViewMode = "original" | "translation" | "side-by-side";

export function TranscriptView({ document: doc }: { document: Document }) {
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");
  const hasTranslation = !!doc.translationContent;

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-2 border-b border-stone-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("original")}
            className={`rounded px-2 py-0.5 text-[11px] ${
              viewMode === "original" ? "bg-stone-100 text-stone-900 font-medium" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Original
          </button>
          {hasTranslation && (
            <>
              <button
                onClick={() => setViewMode("translation")}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  viewMode === "translation" ? "bg-stone-100 text-stone-900 font-medium" : "text-stone-400 hover:text-stone-600"
                }`}
              >
                Translation
              </button>
              <button
                onClick={() => setViewMode("side-by-side")}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  viewMode === "side-by-side" ? "bg-stone-100 text-stone-900 font-medium" : "text-stone-400 hover:text-stone-600"
                }`}
              >
                Side by side
              </button>
            </>
          )}
        </div>
        <CopyDropdown document={doc} />
      </div>

      {viewMode === "original" && (
        <div className="px-6 py-4 max-w-2xl mx-auto font-serif text-stone-900 leading-relaxed">
          <TextAnnotator document={doc} />
        </div>
      )}

      {viewMode === "translation" && hasTranslation && (
        <div className="px-6 py-4 max-w-2xl mx-auto font-serif text-stone-600 leading-relaxed">
          <TextAnnotator document={doc} isTranslation />
        </div>
      )}

      {viewMode === "side-by-side" && (
        <AlignedSideBySide document={doc} />
      )}
    </div>
  );
}

/**
 * Side-by-side view with coding support. Each segment row is codable
 * on both original and translation sides.
 */
function AlignedSideBySide({ document: doc }: { document: Document }) {
  const codes = useCodebook(doc.projectId);
  const { applyCoding } = useCodingActions(doc);
  const [recentCodeIds, setRecentCodeIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<{
    position: { x: number; y: number };
    segmentIndex: number;
    isTranslation: boolean;
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);

  // Get all codings for this document
  const originalCodings = useLiveQuery(
    () => db.codings.where("documentId").equals(doc.id)
      .filter((c) => c.deletedAt === null && !c.isTranslation).toArray(),
    [doc.id]
  );
  const translationCodings = useLiveQuery(
    () => db.codings.where("documentId").equals(doc.id)
      .filter((c) => c.deletedAt === null && c.isTranslation).toArray(),
    [doc.id]
  );

  const codeMap = new Map<string, Code>();
  for (const code of codes ?? []) codeMap.set(code.id, code);

  // Compute segment offset ranges in the full content strings
  const segmentOffsets = useCallback(() => {
    const original: { start: number; end: number }[] = [];
    const translation: { start: number; end: number }[] = [];

    let oPos = 0;
    let tPos = 0;

    for (const seg of doc.segments) {
      const oText = `${seg.speaker} · ${seg.timestamp}\n${seg.content}`;
      original.push({ start: oPos, end: oPos + oText.length });
      oPos += oText.length + 2; // +2 for \n\n separator

      if (seg.translation && seg.translation !== seg.content) {
        const tText = `${seg.speaker} · ${seg.timestamp}\n${seg.translation}`;
        translation.push({ start: tPos, end: tPos + tText.length });
        tPos += tText.length + 2;
      } else {
        translation.push({ start: tPos, end: tPos });
      }
    }

    return { original, translation };
  }, [doc.segments])();

  function handleMouseUp(
    e: React.MouseEvent,
    segmentIndex: number,
    isTranslation: boolean
  ) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString();
    if (!text.trim()) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate offset within the full content string
    const offsets = isTranslation
      ? segmentOffsets.translation[segmentIndex]
      : segmentOffsets.original[segmentIndex];

    if (!offsets) return;

    // Get offset within the segment's content
    const container = (e.target as HTMLElement).closest("[data-segment-content]");
    if (!container) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let startOffset = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      if (node === range.startContainer) {
        startOffset = charCount + range.startOffset;
      }
      charCount += (node.textContent?.length ?? 0);
    }

    // Map to full content string offset
    // The segment content starts after "Speaker · Timestamp\n"
    const seg = doc.segments[segmentIndex];
    const headerLen = `${seg.speaker} · ${seg.timestamp}\n`.length;
    const fullStart = offsets.start + headerLen + startOffset;
    const fullEnd = fullStart + text.length;

    setPicker({
      position: { x: Math.min(rect.left, window.innerWidth - 220), y: rect.bottom + 4 },
      segmentIndex,
      isTranslation,
      text,
      startOffset: fullStart,
      endOffset: fullEnd,
    });
  }

  async function handleCodeSelect(codeIds: string[]) {
    if (!picker) return;

    for (const codeId of codeIds) {
      await applyCoding({
        codeId,
        startOffset: picker.startOffset,
        endOffset: picker.endOffset,
        quotedText: picker.text,
        isTranslation: picker.isTranslation,
      });
    }

    setRecentCodeIds((prev) => {
      const filtered = prev.filter((id) => !codeIds.includes(id));
      return [...codeIds, ...filtered].slice(0, 5);
    });

    window.getSelection()?.removeAllRanges();
    setPicker(null);
  }

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-2 gap-0 text-[10px] font-medium uppercase tracking-wider text-stone-400 font-sans mb-2 px-2">
        <span>Original</span>
        <span>Translation</span>
      </div>
      <div className="divide-y divide-stone-50">
        {doc.segments.map((seg, i) => (
          <div key={seg.index} className="grid grid-cols-2 gap-4 py-2 px-2 hover:bg-stone-50/50">
            <div
              onMouseUp={(e) => handleMouseUp(e, i, false)}
              className="select-text cursor-text"
            >
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[11px] font-medium text-stone-500 font-sans">{seg.speaker}</span>
                <span className="text-[10px] text-stone-400 font-sans">{seg.timestamp}</span>
              </div>
              <p
                data-segment-content
                data-content-container
                className="font-serif text-stone-900 leading-relaxed whitespace-pre-wrap text-sm"
              >
                <SegmentText
                  text={seg.content}
                  isPendingTarget={picker?.segmentIndex === i && !picker?.isTranslation}
                  pendingText={picker?.text}
                />
              </p>
            </div>
            <div
              onMouseUp={(e) => handleMouseUp(e, i, true)}
              className="select-text cursor-text"
            >
              <p
                data-segment-content
                data-content-container
                className="font-serif text-stone-600 leading-relaxed whitespace-pre-wrap text-sm italic mt-5"
              >
                <SegmentText
                  text={seg.translation && seg.translation !== seg.content ? seg.translation : ""}
                  isPendingTarget={picker?.segmentIndex === i && picker?.isTranslation}
                  pendingText={picker?.text}
                />
              </p>
            </div>
          </div>
        ))}
      </div>

      {picker && codes.length > 0 && (
        <CodePicker
          codes={codes}
          recentCodeIds={recentCodeIds}
          onSelect={handleCodeSelect}
          onClose={() => { window.getSelection()?.removeAllRanges(); setPicker(null); }}
          position={picker.position}
        />
      )}
    </div>
  );
}

/**
 * Renders segment text with a yellow highlight on the pending selection.
 */
function SegmentText({
  text,
  isPendingTarget,
  pendingText,
}: {
  text: string;
  isPendingTarget: boolean;
  pendingText?: string;
}) {
  if (!text) return null;

  if (!isPendingTarget || !pendingText) {
    return <>{text}</>;
  }

  const idx = text.indexOf(pendingText);
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded-sm">{pendingText}</mark>
      {text.slice(idx + pendingText.length)}
    </>
  );
}
