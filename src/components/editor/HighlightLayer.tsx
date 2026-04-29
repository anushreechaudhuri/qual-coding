"use client";

import { useMemo } from "react";
import { splitTextByCodings } from "@/lib/coding/offsetUtils";
import type { Coding, Code } from "@/types";

/**
 * Renders text content with colored highlight overlays for codings.
 *
 * Splits text at coding boundaries and renders each segment as a span.
 * Coded segments get their code's color as a semi-transparent background.
 * Clicking a highlighted span shows its coding detail.
 *
 * Preserves the stored content string byte-for-byte (character offset invariant).
 */
export function HighlightLayer({
  text,
  codings,
  codeMap,
  onCodingClick,
}: {
  text: string;
  codings: Coding[];
  codeMap: Map<string, Code>;
  onCodingClick: (codingId: string) => void;
}) {
  const segments = useMemo(
    () => splitTextByCodings(text, codings),
    [text, codings]
  );

  return (
    <span>
      {segments.map((segment, i) => {
        if (segment.codingIds.length === 0) {
          return <span key={i}>{segment.text}</span>;
        }

        // Get the primary code color for the background
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
              backgroundColor: `${color}30`,
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
