/**
 * Character offset utilities for the coding engine.
 *
 * Codings store start/end offsets into the document's content string.
 * These utilities convert between browser Selection API positions
 * (which reference DOM text nodes) and our stored content offsets.
 *
 * The key invariant: offsets reference the stored content string
 * byte-for-byte. The viewer renders this string without modification.
 */

import type { Coding } from "@/types";

/**
 * Convert a browser Selection to character offsets within a container.
 * Returns null if the selection is outside the container or collapsed.
 */
export function selectionToOffsets(
  selection: Selection,
  container: HTMLElement
): { startOffset: number; endOffset: number; text: string } | null {
  if (selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);

  // Verify the selection is within our container
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  const startOffset = getTextOffset(container, range.startContainer, range.startOffset);
  const endOffset = getTextOffset(container, range.endContainer, range.endOffset);

  if (startOffset === null || endOffset === null || startOffset === endOffset) {
    return null;
  }

  const [start, end] = startOffset < endOffset
    ? [startOffset, endOffset]
    : [endOffset, startOffset];

  return {
    startOffset: start,
    endOffset: end,
    text: selection.toString(),
  };
}

/**
 * Calculate the character offset from the start of a container to a
 * specific position within a descendant text node.
 */
function getTextOffset(
  container: HTMLElement,
  node: Node,
  offset: number
): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let charCount = 0;

  let current = walker.nextNode();
  while (current) {
    if (current === node) {
      return charCount + offset;
    }
    charCount += (current.textContent?.length ?? 0);
    current = walker.nextNode();
  }

  return null;
}

/**
 * Split a text string into segments at coding boundaries.
 * Each segment knows which codings (if any) cover it.
 */
export interface TextSegment {
  text: string;
  startOffset: number;
  endOffset: number;
  codingIds: string[];
}

export function splitTextByCodings(
  text: string,
  codings: Coding[]
): TextSegment[] {
  if (codings.length === 0) {
    return [{ text, startOffset: 0, endOffset: text.length, codingIds: [] }];
  }

  // Collect all boundary points
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);

  for (const coding of codings) {
    boundaries.add(Math.max(0, coding.startOffset));
    boundaries.add(Math.min(text.length, coding.endOffset));
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  const segments: TextSegment[] = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];
    if (start === end) continue;

    const codingIds = codings
      .filter((c) => c.startOffset < end && c.endOffset > start)
      .map((c) => c.id);

    segments.push({
      text: text.slice(start, end),
      startOffset: start,
      endOffset: end,
      codingIds,
    });
  }

  return segments;
}
