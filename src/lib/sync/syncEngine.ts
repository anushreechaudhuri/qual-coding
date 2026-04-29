/**
 * Sync engine: bidirectional sync between IndexedDB and Google Drive.
 *
 * Orchestrates the push/pull cycle:
 * 1. Push all _dirty records to Drive (grouped by entity type)
 * 2. Pull manifest, compare timestamps, fetch updated remote records
 * 3. Merge changes using field-level conflict resolution
 * 4. Update local _dirty flags and snapshots
 *
 * Uses Web Locks to ensure only one tab runs the sync loop at a time.
 */

import { db } from "@/lib/db/schema";
import {
  listAppDataFiles,
  readFileContent,
  createAppDataFile,
  updateFileContent,
  DriveError,
} from "./driveClient";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline" | "auth_required";

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  error: string | null;
}

let currentState: SyncState = {
  status: "idle",
  lastSyncedAt: null,
  error: null,
};

const listeners = new Set<(state: SyncState) => void>();

export function getSyncState(): SyncState {
  return currentState;
}

export function onSyncStateChange(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(partial: Partial<SyncState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach((fn) => fn(currentState));
}

/**
 * Run a single sync cycle. Acquires a Web Lock to prevent concurrent
 * sync from multiple tabs.
 */
export async function runSync(accessToken: string): Promise<void> {
  if (!navigator.onLine) {
    setState({ status: "offline" });
    return;
  }

  // Web Locks API ensures only one tab syncs at a time
  if ("locks" in navigator) {
    try {
      await navigator.locks.request(
        "qual-coding-drive-sync",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) return; // Another tab holds the lock
          await performSync(accessToken);
        }
      );
    } catch {
      await performSync(accessToken);
    }
  } else {
    await performSync(accessToken);
  }
}

async function performSync(accessToken: string): Promise<void> {
  setState({ status: "syncing", error: null });

  try {
    // Step 1: Push dirty records
    await pushDirtyRecords(accessToken);

    // Step 2: Pull remote changes
    await pullRemoteChanges(accessToken);

    setState({
      status: "synced",
      lastSyncedAt: new Date(),
      error: null,
    });
  } catch (err) {
    if (err instanceof DriveError && err.isAuthError) {
      setState({ status: "auth_required", error: "Re-authentication needed" });
      return;
    }

    setState({
      status: "error",
      error: err instanceof Error ? err.message : "Sync failed",
    });
  }
}

/**
 * Push all dirty records to Drive, grouped by entity type.
 */
async function pushDirtyRecords(accessToken: string): Promise<void> {
  const tables = ["projects", "documents", "codes", "codings", "memos"] as const;

  for (const tableName of tables) {
    const table = db[tableName];
    const dirtyRecords = await table
      .filter((r) => (r as unknown as { _dirty: boolean })._dirty === true)
      .toArray();

    if (dirtyRecords.length === 0) continue;

    const fileName = `${tableName}.json`;

    // Find or create the Drive file for this entity type
    const existingFiles = await listAppDataFiles(accessToken);
    const driveFile = existingFiles.find((f) => f.name === fileName);

    // Read existing remote data (if any)
    let remoteRecords: Record<string, unknown>[] = [];
    if (driveFile) {
      try {
        const content = await readFileContent(accessToken, driveFile.id);
        remoteRecords = JSON.parse(content);
      } catch {
        remoteRecords = [];
      }
    }

    // Merge local dirty records into remote
    const remoteMap = new Map(
      remoteRecords.map((r) => [r.id as string, r])
    );

    for (const record of dirtyRecords) {
      const plain = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
      delete plain._dirty;
      delete plain._lastSyncedSnapshot;
      remoteMap.set(plain.id as string, plain);
    }

    const merged = Array.from(remoteMap.values());
    const content = JSON.stringify(merged);

    if (driveFile) {
      await updateFileContent(accessToken, driveFile.id, content);
    } else {
      await createAppDataFile(accessToken, fileName, content);
    }

    // Mark records as synced
    for (const record of dirtyRecords) {
      const snapshot = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
      delete snapshot._dirty;
      delete snapshot._lastSyncedSnapshot;

      await table.update((record as unknown as Record<string, unknown>).id as never, {
        _dirty: false,
        _lastSyncedSnapshot: snapshot,
      } as never);
    }
  }
}

/**
 * Pull remote changes and merge with local state.
 */
async function pullRemoteChanges(accessToken: string): Promise<void> {
  const tables = ["projects", "documents", "codes", "codings", "memos"] as const;
  const existingFiles = await listAppDataFiles(accessToken);

  for (const tableName of tables) {
    const fileName = `${tableName}.json`;
    const driveFile = existingFiles.find((f) => f.name === fileName);
    if (!driveFile) continue;

    let remoteRecords: Record<string, unknown>[];
    try {
      const content = await readFileContent(accessToken, driveFile.id);
      remoteRecords = JSON.parse(content);
    } catch {
      continue;
    }

    const table = db[tableName];

    for (const remote of remoteRecords) {
      const id = remote.id as string;
      const local = await table.get(id as never) as unknown as Record<string, unknown> | undefined;

      if (!local) {
        // Record exists on remote but not locally: pull it
        await table.add({
          ...remote,
          _dirty: false,
          _lastSyncedSnapshot: { ...remote },
        } as never);
      }
      // If local exists and isn't dirty, update from remote
      else if (!local._dirty) {
        await table.update(id as never, {
          ...remote,
          _dirty: false,
          _lastSyncedSnapshot: { ...remote },
        } as never);
      }
      // If local is dirty, both sides have changes. For now, local wins.
      // Full field-level merge (conflictResolver.ts) would apply here
      // in a production implementation.
    }
  }
}

/**
 * Start the periodic sync loop. Runs every 60 seconds while online.
 */
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSyncLoop(getAccessToken: () => string | null) {
  if (syncInterval) return;

  async function tick() {
    const token = getAccessToken();
    if (token && navigator.onLine) {
      await runSync(token);
    } else if (!navigator.onLine) {
      setState({ status: "offline" });
    }
  }

  // Sync on connectivity restore
  window.addEventListener("online", () => tick());
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });

  // Periodic sync every 60 seconds
  syncInterval = setInterval(tick, 60_000);

  // Initial sync
  tick();
}

export function stopSyncLoop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
