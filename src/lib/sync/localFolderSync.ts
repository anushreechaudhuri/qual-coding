/**
 * Local file sync using simple file save/load.
 *
 * Two approaches:
 * 1. showSaveFilePicker (Chrome/Edge): saves to a specific file location,
 *    can be inside a cloud drive folder. Remembers the location.
 * 2. Download fallback: triggers a normal browser download.
 *
 * Both save a single .qualcoding file (JSON) containing all project data.
 * Binary files are saved separately as individual downloads.
 */

import { db } from "@/lib/db/schema";

/**
 * Check if the File System Access API is available.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

/**
 * Save all data to a single file. Uses showSaveFilePicker if available,
 * falls back to download.
 */
export async function saveToFile(
  options: {
    includeBinaries?: boolean;
    onProgress?: (msg: string) => void;
  } = {}
): Promise<{ size: number }> {
  const { includeBinaries = false, onProgress } = options;

  onProgress?.("Collecting data...");

  const [projects, documents, codes, codings, memos, speakers] = await Promise.all([
    db.projects.toArray(),
    db.documents.toArray(),
    db.codes.toArray(),
    db.codings.toArray(),
    db.memos.toArray(),
    db.speakers.toArray(),
  ]);

  // Build binary index (without the actual blobs)
  let binaryData: Array<{ id: string; documentId: string; mimeType: string; base64: string }> = [];

  if (includeBinaries) {
    onProgress?.("Reading binary files...");
    const binaryAssets = await db.binaryAssets.filter((b) => b.deletedAt === null).toArray();

    for (let i = 0; i < binaryAssets.length; i++) {
      const asset = binaryAssets[i];
      if (!asset.blob || asset.blob.size === 0) continue;

      const sizeMB = (asset.blob.size / (1024 * 1024)).toFixed(1);
      onProgress?.(`Encoding file ${i + 1}/${binaryAssets.length} (${sizeMB}MB)...`);

      // Convert to base64 in chunks to avoid memory issues
      const base64 = await blobToBase64(asset.blob);

      binaryData.push({
        id: asset.id,
        documentId: asset.documentId,
        mimeType: asset.mimeType,
        base64,
      });

      // Yield to event loop
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  onProgress?.("Building save file...");

  const saveData = {
    version: 4,
    savedAt: new Date().toISOString(),
    projects,
    documents,
    codes,
    codings,
    memos,
    speakers,
    ...(includeBinaries ? { binaryAssets: binaryData } : {}),
  };

  const json = JSON.stringify(saveData);
  const blob = new Blob([json], { type: "application/json" });

  onProgress?.("Saving...");

  // Try showSaveFilePicker first
  if (isFileSystemAccessSupported()) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: Record<string, unknown>) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: `qualcoding-backup-${new Date().toISOString().split("T")[0]}.json`,
        types: [{
          description: "QualCoding Backup",
          accept: { "application/json": [".json"] },
        }],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return { size: blob.size };
    } catch (err) {
      // User cancelled or API failed, fall through to download
      if ((err as Error).name === "AbortError") {
        throw new Error("Cancelled");
      }
    }
  }

  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qualcoding-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  return { size: blob.size };
}

/**
 * Load data from a backup file.
 */
export async function loadFromFile(
  file: File,
  onProgress?: (msg: string) => void
): Promise<{ tables: Record<string, number> }> {
  onProgress?.("Reading file...");
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.version || !data.projects) {
    throw new Error("Invalid backup file");
  }

  const tables: Record<string, number> = {};

  const tableConfigs = [
    { name: "projects", records: data.projects, table: db.projects },
    { name: "documents", records: data.documents, table: db.documents },
    { name: "codes", records: data.codes, table: db.codes },
    { name: "codings", records: data.codings, table: db.codings },
    { name: "memos", records: data.memos, table: db.memos },
    { name: "speakers", records: data.speakers, table: db.speakers },
  ];

  for (const config of tableConfigs) {
    if (!config.records) continue;
    onProgress?.(`Restoring ${config.name}...`);

    let count = 0;
    for (const record of config.records as Record<string, unknown>[]) {
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
  }

  // Restore binary assets if present
  if (data.binaryAssets && Array.isArray(data.binaryAssets)) {
    onProgress?.("Restoring binary files...");
    let binaryCount = 0;

    for (const entry of data.binaryAssets as Array<{
      id: string;
      documentId: string;
      mimeType: string;
      base64: string;
    }>) {
      const existing = await db.binaryAssets.get(entry.id);
      if (existing?.blob && existing.blob.size > 0) {
        binaryCount++;
        continue;
      }

      onProgress?.(`Restoring file ${binaryCount + 1}...`);
      const blob = base64ToBlob(entry.base64, entry.mimeType);

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
    }
    tables["binaryAssets"] = binaryCount;
  }

  return { tables };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
