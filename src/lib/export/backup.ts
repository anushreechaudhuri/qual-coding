/**
 * Full local database backup and restore.
 *
 * Exports ALL IndexedDB data (projects, documents, codes, codings, memos)
 * to a single JSON file. Binary assets are excluded (too large) but
 * everything else is preserved including sync metadata.
 *
 * Restore replaces the entire database contents.
 */

import { db } from "@/lib/db/schema";
import { downloadFile } from "./exporters";

export interface DatabaseBackup {
  version: number;
  exportedAt: string;
  projects: unknown[];
  documents: unknown[];
  codes: unknown[];
  codings: unknown[];
  memos: unknown[];
}

export async function exportFullBackup(): Promise<void> {
  const [projects, documents, codes, codings, memos] = await Promise.all([
    db.projects.toArray(),
    db.documents.toArray(),
    db.codes.toArray(),
    db.codings.toArray(),
    db.memos.toArray(),
  ]);

  // Strip binary blobs from documents (content is kept, just not the raw files)
  const docsClean = documents.map((d) => ({ ...d, binaryAssetId: d.binaryAssetId }));

  const backup: DatabaseBackup = {
    version: 3,
    exportedAt: new Date().toISOString(),
    projects,
    documents: docsClean,
    codes,
    codings,
    memos,
  };

  const json = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().split("T")[0];
  downloadFile(json, `qual-coding-backup-${date}.json`, "application/json");
}

export async function importFullBackup(file: File): Promise<{ counts: Record<string, number> }> {
  const text = await file.text();
  const backup = JSON.parse(text) as DatabaseBackup;

  if (!backup.version || !backup.projects || !backup.documents) {
    throw new Error("Invalid backup file format");
  }

  const counts: Record<string, number> = {};

  await db.transaction(
    "rw",
    [db.projects, db.documents, db.codes, db.codings, db.memos],
    async () => {
      // Restore projects
      for (const project of backup.projects) {
        const p = project as Record<string, unknown>;
        // Ensure codebookGroupId exists (backups from before v3)
        if (!p.codebookGroupId) p.codebookGroupId = p.id;
        // Convert date strings back to Date objects
        p.createdAt = new Date(p.createdAt as string);
        p.updatedAt = new Date(p.updatedAt as string);
        p.deletedAt = p.deletedAt ? new Date(p.deletedAt as string) : null;

        const existing = await db.projects.get(p.id as string);
        if (existing) {
          await db.projects.update(p.id as string, p as never);
        } else {
          await db.projects.add(p as never);
        }
      }
      counts.projects = backup.projects.length;

      // Restore documents
      for (const doc of backup.documents) {
        const d = doc as Record<string, unknown>;
        d.createdAt = new Date(d.createdAt as string);
        d.updatedAt = new Date(d.updatedAt as string);
        d.deletedAt = d.deletedAt ? new Date(d.deletedAt as string) : null;

        const existing = await db.documents.get(d.id as string);
        if (existing) {
          await db.documents.update(d.id as string, d as never);
        } else {
          await db.documents.add(d as never);
        }
      }
      counts.documents = backup.documents.length;

      // Restore codes
      for (const code of backup.codes) {
        const c = code as Record<string, unknown>;
        c.createdAt = new Date(c.createdAt as string);
        c.updatedAt = new Date(c.updatedAt as string);
        c.deletedAt = c.deletedAt ? new Date(c.deletedAt as string) : null;

        const existing = await db.codes.get(c.id as string);
        if (existing) {
          await db.codes.update(c.id as string, c as never);
        } else {
          await db.codes.add(c as never);
        }
      }
      counts.codes = backup.codes.length;

      // Restore codings
      for (const coding of backup.codings) {
        const c = coding as Record<string, unknown>;
        c.createdAt = new Date(c.createdAt as string);
        c.updatedAt = new Date(c.updatedAt as string);
        c.deletedAt = c.deletedAt ? new Date(c.deletedAt as string) : null;

        const existing = await db.codings.get(c.id as string);
        if (existing) {
          await db.codings.update(c.id as string, c as never);
        } else {
          await db.codings.add(c as never);
        }
      }
      counts.codings = backup.codings.length;

      // Restore memos
      for (const memo of backup.memos) {
        const m = memo as Record<string, unknown>;
        m.createdAt = new Date(m.createdAt as string);
        m.updatedAt = new Date(m.updatedAt as string);
        m.deletedAt = m.deletedAt ? new Date(m.deletedAt as string) : null;

        const existing = await db.memos.get(m.id as string);
        if (existing) {
          await db.memos.update(m.id as string, m as never);
        } else {
          await db.memos.add(m as never);
        }
      }
      counts.memos = backup.memos.length;
    }
  );

  return { counts };
}
