/**
 * Adjusts coding character offsets when document content is edited.
 *
 * Given old content and new content, computes a simple diff and shifts
 * all coding offsets accordingly:
 * - Codings entirely before the edit: no change
 * - Codings entirely after the edit: shift by the length difference
 * - Codings spanning the edit point: adjust endOffset
 * - Codings entirely within a deleted range: mark for removal
 * - Updates quotedText from the new content
 */

import { db } from "@/lib/db/schema";
import type { Coding } from "@/types";

export interface OffsetAdjustResult {
  updated: number;
  removed: number;
}

export async function adjustCodingOffsets(
  documentId: string,
  oldContent: string,
  newContent: string
): Promise<OffsetAdjustResult> {
  const codings = await db.codings
    .where("documentId")
    .equals(documentId)
    .filter((c) => c.deletedAt === null)
    .toArray();

  if (codings.length === 0) return { updated: 0, removed: 0 };

  // Find the first point where old and new differ
  const editStart = findEditStart(oldContent, newContent);
  // Find how far from the end they match
  const editEndOld = findEditEndFromRight(oldContent, newContent, editStart);
  const editEndNew = findEditEndFromRight(newContent, oldContent, editStart);

  const deletedLength = editEndOld - editStart;
  const insertedLength = editEndNew - editStart;
  const shift = insertedLength - deletedLength;

  let updated = 0;
  let removed = 0;
  const now = new Date();

  for (const coding of codings) {
    const codingEnd = coding.endOffset;
    const codingStart = coding.startOffset;

    // Case 1: coding is entirely before the edit
    if (codingEnd <= editStart) {
      continue;
    }

    // Case 2: coding is entirely within the deleted range
    if (codingStart >= editStart && codingEnd <= editEndOld) {
      await db.codings.update(coding.id, {
        deletedAt: now,
        updatedAt: now,
        _dirty: true,
      });
      removed++;
      continue;
    }

    // Case 3: coding is entirely after the edit
    if (codingStart >= editEndOld) {
      const newStart = codingStart + shift;
      const newEnd = codingEnd + shift;
      const quotedText = newContent.slice(newStart, newEnd);
      await db.codings.update(coding.id, {
        startOffset: newStart,
        endOffset: newEnd,
        quotedText,
        updatedAt: now,
        _dirty: true,
      });
      updated++;
      continue;
    }

    // Case 4: coding spans the edit point (partial overlap)
    const newStart = Math.min(codingStart, editStart);
    const newEnd = Math.max(codingEnd + shift, editStart);

    if (newEnd <= newStart) {
      // Coding collapsed to nothing
      await db.codings.update(coding.id, {
        deletedAt: now,
        updatedAt: now,
        _dirty: true,
      });
      removed++;
    } else {
      const quotedText = newContent.slice(newStart, newEnd);
      await db.codings.update(coding.id, {
        startOffset: newStart,
        endOffset: newEnd,
        quotedText,
        updatedAt: now,
        _dirty: true,
      });
      updated++;
    }
  }

  return { updated, removed };
}

function findEditStart(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return len;
}

function findEditEndFromRight(
  primary: string,
  other: string,
  editStart: number
): number {
  let pi = primary.length - 1;
  let oi = other.length - 1;

  while (pi >= editStart && oi >= editStart && primary[pi] === other[oi]) {
    pi--;
    oi--;
  }

  return pi + 1;
}
