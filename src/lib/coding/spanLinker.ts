/**
 * Bilingual span linking for audio documents.
 *
 * When a user codes a span in the original text, we find which audio
 * segments the selection covers and create a linked coding on the
 * corresponding translation segments (and vice versa).
 *
 * Linking is at the segment level: we identify which segments are
 * covered by the selection, then create a coding that spans the full
 * translation text of those segments.
 */

import type { AudioSegment } from "@/types";

/**
 * Given a character offset range in the content string, find which
 * audio segment indices are covered. The content string is built by
 * joining segment content with speaker headers:
 *
 *   "Speaker 1 · 00:23\nOriginal text\n\nSpeaker 2 · 01:14\n..."
 *
 * We map offsets to segments by computing the cumulative offset of
 * each segment in the content string.
 */
export function findCoveredSegments(
  startOffset: number,
  endOffset: number,
  segments: AudioSegment[],
  content: string
): number[] {
  if (segments.length === 0) return [];

  const segmentRanges = computeSegmentRanges(segments, content);
  const covered: number[] = [];

  for (const range of segmentRanges) {
    // A segment is covered if the selection overlaps with it
    if (range.startOffset < endOffset && range.endOffset > startOffset) {
      covered.push(range.segmentIndex);
    }
  }

  return covered;
}

/**
 * Given covered segment indices, compute the offset range in the
 * translation content string that corresponds to those segments.
 * Returns null if no translation exists for the covered segments.
 */
export function getLinkedTranslationRange(
  coveredSegmentIndices: number[],
  segments: AudioSegment[],
  translationContent: string
): { startOffset: number; endOffset: number; text: string } | null {
  if (!translationContent || coveredSegmentIndices.length === 0) return null;

  const translationRanges = computeSegmentRanges(
    segments.filter((s) => s.translation),
    translationContent
  );

  const coveredSet = new Set(coveredSegmentIndices);
  const matchingRanges = translationRanges.filter((r) =>
    coveredSet.has(r.segmentIndex)
  );

  if (matchingRanges.length === 0) return null;

  const startOffset = Math.min(...matchingRanges.map((r) => r.startOffset));
  const endOffset = Math.max(...matchingRanges.map((r) => r.endOffset));

  return {
    startOffset,
    endOffset,
    text: translationContent.slice(startOffset, endOffset),
  };
}

interface SegmentRange {
  segmentIndex: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Compute the character offset range for each segment within a content
 * string. The content is formatted as:
 *
 *   "Speaker · Timestamp\nContent\n\nSpeaker · Timestamp\nContent"
 *
 * We find each segment's content substring position in the full string.
 */
function computeSegmentRanges(
  segments: AudioSegment[],
  content: string
): SegmentRange[] {
  const ranges: SegmentRange[] = [];
  let searchFrom = 0;

  for (const segment of segments) {
    const idx = content.indexOf(segment.content, searchFrom);
    if (idx === -1) continue;

    ranges.push({
      segmentIndex: segment.index,
      startOffset: idx,
      endOffset: idx + segment.content.length,
    });

    searchFrom = idx + segment.content.length;
  }

  return ranges;
}
