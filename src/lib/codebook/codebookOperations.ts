/**
 * Higher-level codebook operations: merge, split.
 *
 * These compose multiple db/operations.ts calls within transactions.
 * All writes go through the base operations layer to maintain the
 * _dirty invariant.
 */

import { db } from "@/lib/db/schema";
import { updateCode, deleteCode, createCode, type CreateCodeInput } from "@/lib/db/operations";

/**
 * Merge sourceId into targetId: transfer all codings from source to target,
 * then soft-delete the source code.
 */
export async function mergeCodes(
  sourceId: string,
  targetId: string
): Promise<void> {
  const now = new Date();

  await db.transaction("rw", [db.codes, db.codings], async () => {
    // Transfer all codings from source to target
    await db.codings
      .where("codeId")
      .equals(sourceId)
      .modify({
        codeId: targetId,
        updatedAt: now,
        _dirty: true,
      });

    // Soft-delete the source code
    await deleteCode(sourceId);
  });
}

/**
 * Split: create a new child code under a parent. Does not move codings
 * automatically; the user reassigns specific codings in the UI.
 */
export async function splitCode(
  parentId: string,
  newCodeInput: CreateCodeInput
): Promise<string> {
  const newCode = await createCode({
    ...newCodeInput,
    parentId,
  });
  return newCode.id;
}

/**
 * Reorder: move a code to a new parent (or to top level with parentId = null).
 */
export async function reparentCode(
  codeId: string,
  newParentId: string | null
): Promise<void> {
  await updateCode(codeId, { parentId: newParentId });
}
