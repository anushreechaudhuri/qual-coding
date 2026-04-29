"use client";

import { useMemo } from "react";
import { splitTextByCodings } from "@/lib/coding/offsetUtils";
import type { Coding, Code } from "@/types";

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
  onCodingClick: (codingId: string, event: React.MouseEvent) => void;
  pendingSelection?: { startOffset: number; endOffset: number } | null;
}) {
  const segments = useMemo(
    () => splitTextByCodings(text, codings),
    [text, codings]
  );

  return (
    <span>
      {segments.map((segment, i) => {
        const hasCoding = segment.codingIds.length > 0;

        // Get coding color if applicable
        let codingColor: string | null = null;
        let codingName: string | undefined;
        let primaryCodingId: string | null = null;
        if (hasCoding) {
          primaryCodingId = segment.codingIds[0];
          const primaryCoding = codings.find((c) => c.id === primaryCodingId);
          const primaryCode = primaryCoding ? codeMap.get(primaryCoding.codeId) : null;
          codingColor = primaryCode?.color ?? "#78716c";
          codingName = segment.codingIds.length > 1
            ? `${segment.codingIds.length} codes applied`
            : primaryCode?.name;
        }

        // Does pending selection overlap this segment?
        const pendStart = pendingSelection?.startOffset ?? 0;
        const pendEnd = pendingSelection?.endOffset ?? 0;
        const hasPending =
          pendingSelection &&
          pendStart < segment.endOffset &&
          pendEnd > segment.startOffset;

        // No highlight at all
        if (!hasCoding && !hasPending) {
          return <span key={i}>{segment.text}</span>;
        }

        // Only coding highlight, no pending
        if (hasCoding && !hasPending) {
          return (
            <span
              key={i}
              onClick={(e) => primaryCodingId && onCodingClick(primaryCodingId, e)}
              className="cursor-pointer rounded-sm"
              style={{
                backgroundColor: `${codingColor}30`,
                borderBottom: `2px solid ${codingColor}`,
              }}
              title={codingName}
            >
              {segment.text}
            </span>
          );
        }

        // Has pending selection: render with precise overlap highlighting
        const relStart = Math.max(0, pendStart - segment.startOffset);
        const relEnd = Math.min(segment.text.length, pendEnd - segment.startOffset);

        const before = segment.text.slice(0, relStart);
        const highlighted = segment.text.slice(relStart, relEnd);
        const after = segment.text.slice(relEnd);

        const baseStyle = hasCoding
          ? { backgroundColor: `${codingColor}30`, borderBottom: `2px solid ${codingColor}` }
          : {};

        const pendingStyle = { backgroundColor: "#fde68a" };

        return (
          <span
            key={i}
            className={hasCoding ? "cursor-pointer rounded-sm" : ""}
            onClick={hasCoding ? (e) => primaryCodingId && onCodingClick(primaryCodingId, e) : undefined}
            title={codingName}
          >
            {before && <span style={baseStyle}>{before}</span>}
            <span style={{ ...baseStyle, ...pendingStyle }}>{highlighted}</span>
            {after && <span style={baseStyle}>{after}</span>}
          </span>
        );
      })}
    </span>
  );
}
