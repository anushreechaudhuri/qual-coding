/**
 * Field-level conflict resolution for sync.
 *
 * When the same record has been modified both locally and remotely,
 * we diff each version against the _lastSyncedSnapshot to determine
 * which fields each side changed. Fields changed on only one side
 * merge cleanly. Fields changed on both sides resolve to the newer
 * updatedAt timestamp (last-write-wins).
 */

import type { SyncableEntity } from "@/types";

export interface MergeResult {
  merged: Record<string, unknown>;
  conflicts: string[];
}

/**
 * Merge a local record with a remote record using the last-synced
 * snapshot as the common ancestor.
 */
export function mergeRecords(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  snapshot: Record<string, unknown> | null
): MergeResult {
  // No snapshot means this record was never synced. Remote wins for
  // all fields since we can't determine what changed locally.
  if (!snapshot) {
    return { merged: { ...remote }, conflicts: [] };
  }

  const merged: Record<string, unknown> = { ...snapshot };
  const conflicts: string[] = [];

  const allKeys = new Set([
    ...Object.keys(local),
    ...Object.keys(remote),
    ...Object.keys(snapshot),
  ]);

  // Skip sync-internal fields
  const skipFields = new Set(["_dirty", "_lastSyncedSnapshot"]);

  for (const key of allKeys) {
    if (skipFields.has(key)) continue;

    const localVal = local[key];
    const remoteVal = remote[key];
    const snapshotVal = snapshot[key];

    const localChanged = !deepEqual(localVal, snapshotVal);
    const remoteChanged = !deepEqual(remoteVal, snapshotVal);

    if (localChanged && !remoteChanged) {
      merged[key] = localVal;
    } else if (!localChanged && remoteChanged) {
      merged[key] = remoteVal;
    } else if (localChanged && remoteChanged) {
      // Both sides changed the same field. Newer updatedAt wins.
      const localTime = toTime(local.updatedAt);
      const remoteTime = toTime(remote.updatedAt);
      merged[key] = localTime >= remoteTime ? localVal : remoteVal;
      conflicts.push(key);
    } else {
      merged[key] = snapshotVal;
    }
  }

  return { merged, conflicts };
}

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  if (typeof value === "number") return value;
  return 0;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    return Array.from(keys).every((k) => deepEqual(aObj[k], bObj[k]));
  }

  return false;
}
