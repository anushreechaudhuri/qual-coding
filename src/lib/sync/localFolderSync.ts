/**
 * Local folder sync using the File System Access API.
 *
 * User picks a folder on their computer (e.g., inside Google Drive,
 * Dropbox, pCloud, or OneDrive). We save JSON data files there
 * periodically. Cloud desktop apps handle the cloud sync automatically.
 *
 * No OAuth, no API keys, no quota limits. Works with any cloud provider.
 * The directory handle persists in IndexedDB across sessions.
 */

import { db } from "@/lib/db/schema";

const HANDLE_STORE_KEY = "qual-coding:sync-folder-handle";

/**
 * Check if the File System Access API is available.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Prompt user to pick a sync folder.
 */
export async function pickSyncFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await (window as unknown as { showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
      mode: "readwrite",
      startIn: "documents",
    });

    // Store handle in IndexedDB for reuse
    await saveFolderHandle(handle);
    return handle;
  } catch {
    return null;
  }
}

/**
 * Get the previously selected sync folder, if still accessible.
 */
export async function getSavedFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const stored = await db.table("syncMeta").get(HANDLE_STORE_KEY);
    if (!stored?.handle) return null;

    const handle = stored.handle as FileSystemDirectoryHandle;

    // Verify we still have permission
    const perm = await (handle as unknown as { queryPermission: (opts: Record<string, string>) => Promise<string> }).queryPermission({ mode: "readwrite" });
    if (perm === "granted") return handle;

    // Try to request permission
    const req = await (handle as unknown as { requestPermission: (opts: Record<string, string>) => Promise<string> }).requestPermission({ mode: "readwrite" });
    if (req === "granted") return handle;

    return null;
  } catch {
    return null;
  }
}

async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.table("syncMeta").put({
    entityType: HANDLE_STORE_KEY,
    handle,
    lastSyncedAt: new Date(),
    driveFileId: null,
  });
}

/**
 * Clear the saved folder handle.
 */
export async function clearSyncFolder(): Promise<void> {
  await db.table("syncMeta").delete(HANDLE_STORE_KEY);
}

/**
 * Export all data to the sync folder as JSON files.
 */
export async function syncToFolder(
  handle: FileSystemDirectoryHandle,
  options: { includeBinaries?: boolean; onProgress?: (msg: string) => void } = {}
): Promise<{
  files: number;
  size: number;
}> {
  const { includeBinaries = false, onProgress } = options;
  let totalSize = 0;
  let fileCount = 0;

  // Create a QualCoding subfolder
  const appFolder = await handle.getDirectoryHandle("QualCoding", { create: true });

  // Export each table as a JSON file
  const tables = [
    { name: "projects", query: () => db.projects.toArray() },
    { name: "documents", query: () => db.documents.toArray() },
    { name: "codes", query: () => db.codes.toArray() },
    { name: "codings", query: () => db.codings.toArray() },
    { name: "memos", query: () => db.memos.toArray() },
    { name: "speakers", query: () => db.speakers.toArray() },
  ];

  for (const table of tables) {
    onProgress?.(`Saving ${table.name}...`);
    const data = await table.query();
    const json = JSON.stringify(data, null, 2);

    const file = await appFolder.getFileHandle(`${table.name}.json`, { create: true });
    const writable = await file.createWritable();
    await writable.write(json);
    await writable.close();

    totalSize += json.length;
    fileCount++;
  }

  // Export binary assets (audio files, PDFs) as actual files
  if (!includeBinaries) {
    // Write manifest without binaries
    onProgress?.("Writing manifest...");
    const manifest = JSON.stringify({
      syncedAt: new Date().toISOString(),
      tables: tables.map((t) => t.name),
      binaryCount: 0,
      version: 4,
    }, null, 2);

    const manifestFile = await appFolder.getFileHandle("manifest.json", { create: true });
    const writable = await manifestFile.createWritable();
    await writable.write(manifest);
    await writable.close();
    fileCount++;

    return { files: fileCount, size: totalSize };
  }
  const binaryFolder = await appFolder.getDirectoryHandle("files", { create: true });
  const binaryAssets = await db.binaryAssets.filter((b) => b.deletedAt === null).toArray();

  for (let i = 0; i < binaryAssets.length; i++) {
    const asset = binaryAssets[i];
    if (!asset.blob || asset.blob.size === 0) continue;
    const ext = asset.mimeType.split("/")[1]?.replace("mpeg", "mp3").replace("mp4", "m4a") ?? "bin";
    const fileName = `${asset.id}.${ext}`;
    const sizeMB = (asset.blob.size / (1024 * 1024)).toFixed(1);
    onProgress?.(`Saving file ${i + 1}/${binaryAssets.length} (${sizeMB}MB)...`);

    // Yield to event loop between large files to prevent browser freeze
    await new Promise((r) => setTimeout(r, 50));

    try {
      const file = await binaryFolder.getFileHandle(fileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(asset.blob);
      await writable.close();
      totalSize += asset.blob.size;
      fileCount++;
    } catch (err) {
      console.warn(`[sync] Failed to write binary ${fileName}:`, err);
    }
  }

  // Write binary index so we can restore the metadata mapping
  const binaryIndex = binaryAssets.map((a) => ({
    id: a.id,
    documentId: a.documentId,
    mimeType: a.mimeType,
    size: a.blob?.size ?? 0,
    fileName: `${a.id}.${a.mimeType.split("/")[1]?.replace("mpeg", "mp3").replace("mp4", "m4a") ?? "bin"}`,
  }));
  const indexFile = await binaryFolder.getFileHandle("index.json", { create: true });
  const indexWritable = await indexFile.createWritable();
  await indexWritable.write(JSON.stringify(binaryIndex, null, 2));
  await indexWritable.close();
  fileCount++;

  // Write a manifest with sync timestamp
  const manifest = JSON.stringify({
    syncedAt: new Date().toISOString(),
    tables: tables.map((t) => t.name),
    binaryCount: binaryAssets.length,
    version: 4,
  }, null, 2);

  const manifestFile = await appFolder.getFileHandle("manifest.json", { create: true });
  const writable = await manifestFile.createWritable();
  await writable.write(manifest);
  await writable.close();
  fileCount++;

  return { files: fileCount, size: totalSize };
}

/**
 * Import data from the sync folder.
 */
export async function syncFromFolder(handle: FileSystemDirectoryHandle): Promise<{
  tables: Record<string, number>;
}> {
  const appFolder = await handle.getDirectoryHandle("QualCoding");
  const tables: Record<string, number> = {};

  const tableConfigs = [
    { name: "projects", table: db.projects },
    { name: "documents", table: db.documents },
    { name: "codes", table: db.codes },
    { name: "codings", table: db.codings },
    { name: "memos", table: db.memos },
    { name: "speakers", table: db.speakers },
  ];

  for (const config of tableConfigs) {
    try {
      const fileHandle = await appFolder.getFileHandle(`${config.name}.json`);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const records = JSON.parse(text) as Record<string, unknown>[];

      let count = 0;
      for (const record of records) {
        // Convert date strings back to Date objects
        for (const key of ["createdAt", "updatedAt", "deletedAt"]) {
          if (record[key] && typeof record[key] === "string") {
            record[key] = new Date(record[key] as string);
          }
        }

        const existing = await config.table.get(record.id as never);
        if (existing) {
          await config.table.update(record.id as never, record as never);
        } else {
          await config.table.add(record as never);
        }
        count++;
      }
      tables[config.name] = count;
    } catch {
      // File doesn't exist, skip
    }
  }

  // Restore binary assets
  try {
    const binaryFolder = await appFolder.getDirectoryHandle("files");
    const indexHandle = await binaryFolder.getFileHandle("index.json");
    const indexFile = await indexHandle.getFile();
    const binaryIndex = JSON.parse(await indexFile.text()) as Array<{
      id: string;
      documentId: string;
      mimeType: string;
      fileName: string;
    }>;

    let binaryCount = 0;
    for (const entry of binaryIndex) {
      // Skip if already in IndexedDB
      const existing = await db.binaryAssets.get(entry.id);
      if (existing?.blob && existing.blob.size > 0) {
        binaryCount++;
        continue;
      }

      try {
        const fileHandle = await binaryFolder.getFileHandle(entry.fileName);
        const file = await fileHandle.getFile();
        const blob = new Blob([await file.arrayBuffer()], { type: entry.mimeType });

        if (existing) {
          await db.binaryAssets.update(entry.id, { blob, mimeType: entry.mimeType });
        } else {
          await db.binaryAssets.add({
            id: entry.id,
            documentId: entry.documentId,
            blob,
            mimeType: entry.mimeType,
            driveFileId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            _dirty: false,
            _lastSyncedSnapshot: null,
          } as never);
        }
        binaryCount++;
      } catch {
        console.warn(`[sync] Failed to restore binary ${entry.fileName}`);
      }
    }
    tables["binaryAssets"] = binaryCount;
  } catch {
    // No binary folder, skip
  }

  return { tables };
}

/**
 * Get info about the sync folder.
 */
export async function getSyncFolderInfo(handle: FileSystemDirectoryHandle): Promise<{
  name: string;
  lastSynced: string | null;
}> {
  try {
    const appFolder = await handle.getDirectoryHandle("QualCoding");
    const manifestHandle = await appFolder.getFileHandle("manifest.json");
    const file = await manifestHandle.getFile();
    const manifest = JSON.parse(await file.text());
    return {
      name: handle.name,
      lastSynced: manifest.syncedAt,
    };
  } catch {
    return {
      name: handle.name,
      lastSynced: null,
    };
  }
}
