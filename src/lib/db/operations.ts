/**
 * CRUD operations for all database tables.
 *
 * Every write operation in the app flows through these functions.
 * They handle two things automatically:
 * 1. Setting _dirty = true so the sync engine knows what to push
 * 2. Setting updatedAt to the current time
 *
 * This is the single source of truth for data mutations. Other modules
 * (codebookOperations, ingestion, etc.) should call these functions
 * rather than writing to Dexie directly.
 */

import { db } from "./schema";
import type {
  Project,
  Document,
  Code,
  Coding,
  Memo,
  BinaryAsset,
  SyncableEntity,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Stamps a new entity with sync-tracking fields.
 * Every new record starts dirty (needs to be pushed to Drive).
 */
function withSyncFields<T extends Record<string, unknown>>(
  fields: T
): T & SyncableEntity {
  const now = new Date();
  return {
    ...fields,
    id: (fields.id as string) ?? generateId(),
    createdAt: (fields.createdAt as Date) ?? now,
    updatedAt: now,
    deletedAt: null,
    _dirty: true,
    _lastSyncedSnapshot: null,
  } as T & SyncableEntity;
}

/**
 * Marks a record as locally modified. Used before every update.
 */
function dirtyFields(): Partial<SyncableEntity> {
  return {
    updatedAt: new Date(),
    _dirty: true,
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(
  name: string
): Promise<Project> {
  const fields = withSyncFields({ name, codebookGroupId: "" });
  fields.codebookGroupId = fields.id;
  const project = fields as Project;
  await db.projects.add(project);
  return project;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function listProjects(): Promise<Project[]> {
  return db.projects.where("deletedAt").equals(null as unknown as Date).toArray();
}

export async function updateProject(
  id: string,
  changes: Partial<Pick<Project, "name" | "codebookGroupId">>
): Promise<void> {
  await db.projects.update(id, { ...changes, ...dirtyFields() });
}

export async function deleteProject(id: string): Promise<void> {
  const now = new Date();
  const softDelete = { deletedAt: now, ...dirtyFields() };

  await db.transaction(
    "rw",
    [db.projects, db.documents, db.codes, db.codings, db.memos, db.binaryAssets],
    async () => {
      await db.projects.update(id, softDelete);
      await db.documents.where("projectId").equals(id).modify(softDelete);
      await db.codes.where("projectId").equals(id).modify(softDelete);
      await db.codings.where("projectId").equals(id).modify(softDelete);
      await db.memos.where("projectId").equals(id).modify(softDelete);

      // Soft-delete binary assets for all documents in this project
      const docIds = await db.documents
        .where("projectId")
        .equals(id)
        .primaryKeys();
      for (const docId of docIds) {
        await db.binaryAssets.where("documentId").equals(docId).modify(softDelete);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type CreateDocumentInput = Pick<
  Document,
  | "projectId"
  | "title"
  | "purpose"
  | "language"
  | "dateCollected"
  | "notes"
  | "fileType"
  | "status"
  | "content"
  | "translationContent"
  | "segments"
  | "metadata"
  | "binaryAssetId"
  | "errorMessage"
>;

export async function createDocument(
  input: CreateDocumentInput
): Promise<Document> {
  const doc = withSyncFields(input) as Document;
  await db.documents.add(doc);
  return doc;
}

export async function getDocument(id: string): Promise<Document | undefined> {
  return db.documents.get(id);
}

export async function listDocumentsByProject(
  projectId: string
): Promise<Document[]> {
  return db.documents
    .where("projectId")
    .equals(projectId)
    .filter((doc) => doc.deletedAt === null)
    .toArray();
}

export async function updateDocument(
  id: string,
  changes: Partial<Document>
): Promise<void> {
  await db.documents.update(id, { ...changes, ...dirtyFields() });
}

export async function deleteDocument(id: string): Promise<void> {
  const now = new Date();
  const softDelete = { deletedAt: now, ...dirtyFields() };

  await db.transaction("rw", [db.documents, db.codings, db.memos, db.binaryAssets], async () => {
    await db.documents.update(id, softDelete);
    await db.codings.where("documentId").equals(id).modify(softDelete);
    await db.memos
      .where("[targetType+targetId]")
      .equals(["document", id])
      .modify(softDelete);
    await db.binaryAssets.where("documentId").equals(id).modify(softDelete);
  });
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

export type CreateCodeInput = Pick<
  Code,
  "projectId" | "name" | "parentId" | "definition" | "color" | "provenance"
>;

export async function createCode(input: CreateCodeInput): Promise<Code> {
  const code = withSyncFields(input) as Code;
  await db.codes.add(code);
  return code;
}

export async function getCode(id: string): Promise<Code | undefined> {
  return db.codes.get(id);
}

export async function listCodesByProject(projectId: string): Promise<Code[]> {
  return db.codes
    .where("projectId")
    .equals(projectId)
    .filter((c) => c.deletedAt === null)
    .toArray();
}

export async function updateCode(
  id: string,
  changes: Partial<Pick<Code, "name" | "parentId" | "definition" | "color" | "provenance">>
): Promise<void> {
  await db.codes.update(id, { ...changes, ...dirtyFields() });
}

export async function deleteCode(id: string): Promise<void> {
  const softDelete = { deletedAt: new Date(), ...dirtyFields() };
  await db.codes.update(id, softDelete);
}

// ---------------------------------------------------------------------------
// Codings
// ---------------------------------------------------------------------------

export type CreateCodingInput = Pick<
  Coding,
  | "projectId"
  | "documentId"
  | "codeId"
  | "startOffset"
  | "endOffset"
  | "isTranslation"
  | "linkedCodingId"
  | "quotedText"
>;

export async function createCoding(input: CreateCodingInput): Promise<Coding> {
  const coding = withSyncFields(input) as Coding;
  await db.codings.add(coding);
  return coding;
}

export async function listCodingsByDocument(
  documentId: string
): Promise<Coding[]> {
  return db.codings
    .where("documentId")
    .equals(documentId)
    .filter((c) => c.deletedAt === null)
    .toArray();
}

export async function deleteCoding(id: string): Promise<void> {
  const coding = await db.codings.get(id);
  if (!coding) return;

  const softDelete = { deletedAt: new Date(), ...dirtyFields() };

  await db.transaction("rw", [db.codings, db.memos], async () => {
    await db.codings.update(id, softDelete);

    // Also delete the linked coding in the other language track
    if (coding.linkedCodingId) {
      await db.codings.update(coding.linkedCodingId, softDelete);
    }

    // Delete any quotation memos attached to this coding
    await db.memos
      .where("[targetType+targetId]")
      .equals(["quotation", id])
      .modify(softDelete);
  });
}

// ---------------------------------------------------------------------------
// Memos
// ---------------------------------------------------------------------------

export type CreateMemoInput = Pick<
  Memo,
  "projectId" | "targetType" | "targetId" | "content"
>;

export async function createMemo(input: CreateMemoInput): Promise<Memo> {
  const memo = withSyncFields(input) as Memo;
  await db.memos.add(memo);
  return memo;
}

export async function getMemo(id: string): Promise<Memo | undefined> {
  return db.memos.get(id);
}

export async function listMemosByTarget(
  targetType: string,
  targetId: string
): Promise<Memo[]> {
  return db.memos
    .where("[targetType+targetId]")
    .equals([targetType, targetId])
    .filter((m) => m.deletedAt === null)
    .toArray();
}

export async function updateMemo(
  id: string,
  changes: Partial<Pick<Memo, "content">>
): Promise<void> {
  await db.memos.update(id, { ...changes, ...dirtyFields() });
}

export async function deleteMemo(id: string): Promise<void> {
  await db.memos.update(id, { deletedAt: new Date(), ...dirtyFields() });
}

// ---------------------------------------------------------------------------
// Binary Assets
// ---------------------------------------------------------------------------

export async function createBinaryAsset(
  documentId: string,
  blob: Blob,
  mimeType: string
): Promise<BinaryAsset> {
  const asset = withSyncFields({
    documentId,
    blob,
    mimeType,
    driveFileId: null,
  }) as BinaryAsset;
  await db.binaryAssets.add(asset);
  return asset;
}

export async function getBinaryAsset(
  id: string
): Promise<BinaryAsset | undefined> {
  return db.binaryAssets.get(id);
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

/**
 * Mark a record as synced. Called by the sync engine after a successful push.
 * Clears _dirty and stores a snapshot for future conflict resolution.
 */
export async function markSynced<T extends SyncableEntity>(
  table: string,
  id: string,
  snapshot: Record<string, unknown>
): Promise<void> {
  const dexieTable = (db as unknown as Record<string, unknown>)[table] as
    | typeof db.projects
    | undefined;
  if (!dexieTable) return;

  await dexieTable.update(id as never, {
    _dirty: false,
    _lastSyncedSnapshot: snapshot,
  } as never);
}
