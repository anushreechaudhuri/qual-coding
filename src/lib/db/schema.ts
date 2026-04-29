/**
 * Dexie database schema for the qualitative coding tool.
 *
 * Dexie is a wrapper around IndexedDB that gives us reactive queries
 * (useLiveQuery), schema migrations, and cross-tab data propagation.
 *
 * The indexed fields listed after each table name are what Dexie builds
 * indexes on. Fields not listed here are still stored; they just can't
 * be used in .where() queries.
 *
 * Every table includes _dirty for sync tracking and deletedAt for
 * soft-delete propagation. See src/types/index.ts for the full shape
 * of each entity.
 */

import Dexie, { type EntityTable } from "dexie";
import type {
  Project,
  Document,
  Code,
  Coding,
  Memo,
  BinaryAsset,
  Speaker,
  SyncMeta,
} from "@/types";

export class QualCodingDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  documents!: EntityTable<Document, "id">;
  codes!: EntityTable<Code, "id">;
  codings!: EntityTable<Coding, "id">;
  memos!: EntityTable<Memo, "id">;
  binaryAssets!: EntityTable<BinaryAsset, "id">;
  speakers!: EntityTable<Speaker, "id">;
  syncMeta!: EntityTable<SyncMeta, "entityType">;

  constructor() {
    super("QualCodingDB");

    this.version(2).stores({
      projects: "id, updatedAt, _dirty, deletedAt",
      documents:
        "id, projectId, status, [projectId+purpose], [projectId+status], updatedAt, _dirty, deletedAt",
      codes: "id, projectId, [projectId+parentId], updatedAt, _dirty, deletedAt",
      codings:
        "id, projectId, documentId, codeId, [documentId+codeId], updatedAt, _dirty, deletedAt",
      memos:
        "id, projectId, [targetType+targetId], updatedAt, _dirty, deletedAt",
      binaryAssets: "id, documentId, _dirty, deletedAt",
      syncMeta: "entityType",
    });

    // v3: add codebookGroupId to projects for synced codebooks
    this.version(3).stores({
      projects: "id, codebookGroupId, updatedAt, _dirty, deletedAt",
      documents:
        "id, projectId, status, [projectId+purpose], [projectId+status], updatedAt, _dirty, deletedAt",
      codes: "id, projectId, [projectId+parentId], updatedAt, _dirty, deletedAt",
      codings:
        "id, projectId, documentId, codeId, [documentId+codeId], updatedAt, _dirty, deletedAt",
      memos:
        "id, projectId, [targetType+targetId], updatedAt, _dirty, deletedAt",
      binaryAssets: "id, documentId, _dirty, deletedAt",
      syncMeta: "entityType",
    }).upgrade((tx) => {
      // Set codebookGroupId = id for existing projects
      return tx.table("projects").toCollection().modify((project) => {
        if (!project.codebookGroupId) {
          project.codebookGroupId = project.id;
        }
      });
    });

    // v4: add speakers table
    this.version(4).stores({
      projects: "id, codebookGroupId, updatedAt, _dirty, deletedAt",
      documents:
        "id, projectId, status, [projectId+purpose], [projectId+status], updatedAt, _dirty, deletedAt",
      codes: "id, projectId, [projectId+parentId], updatedAt, _dirty, deletedAt",
      codings:
        "id, projectId, documentId, codeId, [documentId+codeId], updatedAt, _dirty, deletedAt",
      memos:
        "id, projectId, [targetType+targetId], updatedAt, _dirty, deletedAt",
      binaryAssets: "id, documentId, _dirty, deletedAt",
      speakers: "id, scope, *projectIds, updatedAt, _dirty, deletedAt",
      syncMeta: "entityType",
    });
  }
}

/**
 * Singleton database instance. Import this wherever you need database access.
 */
export const db = new QualCodingDatabase();
