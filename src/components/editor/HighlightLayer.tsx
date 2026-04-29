"use client";

import { useMemo } from "react";
import { splitTextByCodings, type TextSegment } from "@/lib/coding/offsetUtils";
import type { Coding, Code } from "@/types";

/**
 * Renders text content with colored highlight overlays for codings
 * and a yellow highlight for the pending (not-yet-applied) selection.
 *
 * Preserves the stored content string byte-for-byte (character offset invariant).
 */
export function HighlightLayer({
  text,
  codings,
  codeMap,
  onCodingClick,
  pendingSelection,
}: {
  text: string;
  codings: Coding[];
  codeMap: Map<string, Code>;
  onCodingClick: (codingId: string) => void;
  pendingSelection?: { startOffset: number; endOffset: number } | null;
}) {
  const segments = useMemo(
    () => splitTextByCodings(text, codings),
    [text, codings]
  );

  return (
    <span>
      {segments.map((segment, i) => {
        // Check if this segment overlaps with the pending selection
        const isPending =
          pendingSelection &&
          segment.startOffset < pendingSelection.endOffset &&
          segment.endOffset > pendingSelection.startOffset;

        if (segment.codingIds.length === 0 && !isPending) {
          return <span key={i}>{segment.text}</span>;
        }

        if (segment.codingIds.length === 0 && isPending) {
          // Pending selection only (no existing coding)
          return (
            <span
              key={i}
              className="rounded-sm"
              style={{ backgroundColor: "#fde68a" }}
            >
              {renderPendingOverlap(segment, pendingSelection!)}
            </span>
          );
        }

        // Existing coding highlight
        const primaryCodingId = segment.codingIds[0];
        const primaryCoding = codings.find((c) => c.id === primaryCodingId);
        const primaryCode = primaryCoding
          ? codeMap.get(primaryCoding.codeId)
          : null;
        const color = primaryCode?.color ?? "#78716c";

        return (
          <span
            key={i}
            onClick={() => onCodingClick(primaryCodingId)}
            className="cursor-pointer rounded-sm"
            style={{
              backgroundColor: isPending ? "#fde68a" : `${color}30`,
              borderBottom: `2px solid ${color}`,
            }}
            title={
              segment.codingIds.length > 1
                ? `${segment.codingIds.length} codes applied`
                : primaryCode?.name
            }
          >
            {segment.text}
          </span>
        );
      })}
    </span>
  );
}

/**
 * For a segment that partially overlaps the pending selection,
 * split into highlighted and non-highlighted parts.
 */
function renderPendingOverlap(
  segment: TextSegment,
  pending: { startOffset: number; endOffset: number }
) {
  const relStart = Math.max(0, pending.startOffset - segment.startOffset);
  const relEnd = Math.min(
    segment.text.length,
    pending.endOffset - segment.startOffset
  );

  if (relStart === 0 && relEnd === segment.text.length) {
    return segment.text;
  }

  return (
    <>
      {relStart > 0 && (
        <span style={{ backgroundColor: "transparent" }}>
          {segment.text.slice(0, relStart)}
        </span>
      )}
      <span style={{ backgroundColor: "#fde68a" }}>
        {segment.text.slice(relStart, relEnd)}
      </span>
      {relEnd < segment.text.length && (
        <span style={{ backgroundColor: "transparent" }}>
          {segment.text.slice(relEnd)}
        </span>
      )}
    </>
  );
}
