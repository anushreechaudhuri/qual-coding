/**
 * Core data types for the qualitative coding tool.
 *
 * Every persisted entity extends SyncableEntity, which carries the fields
 * needed for offline-first storage with Google Drive sync.
 */

// ---------------------------------------------------------------------------
// Sync infrastructure
// ---------------------------------------------------------------------------

/**
 * Base fields present on every entity stored in IndexedDB.
 * - _dirty: true when the record has local changes not yet pushed to Drive
 * - _lastSyncedSnapshot: frozen copy of the record at last successful sync,
 *   used by the conflict resolver to determine which fields each side changed
 * - deletedAt: non-null means the record is soft-deleted; the sync engine
 *   propagates the deletion to Drive, then hard-deletes locally
 */
export interface SyncableEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  _dirty: boolean;
  _lastSyncedSnapshot: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

export type DocumentPurpose = "primary" | "secondary" | "context";

export type DocumentStatus = "pending" | "processing" | "ready" | "error";

export type CodeProvenance = "user" | "ai" | "ai_edited" | "imported";

export type MemoTargetType = "project" | "document" | "code" | "quotation";

export interface Project extends SyncableEntity {
  name: string;
  /**
   * Projects sharing a codebook have the same codebookGroupId.
   * Defaults to the project's own ID. When synced, multiple projects
   * point to the same group, and codes are queried by this ID.
   */
  codebookGroupId: string;
}

export interface AudioSegment {
  index: number;
  timestamp: string;
  endTimestamp: string;
  speaker: string;
  content: string;
  translation: string | null;
  language: string;
}

export interface DocumentMetadata {
  originalFileName: string;
  fileSize: number;
  speakerCount?: number;
  durationSeconds?: number;
}

export interface Document extends SyncableEntity {
  projectId: string;
  title: string;
  purpose: DocumentPurpose;
  language: string;
  dateCollected: string;
  notes: string;
  fileType: string;
  status: DocumentStatus;
  /** Canonical content in the original language. Character offsets in codings reference this string. */
  content: string;
  /** Translation track (e.g., English translation of Bangla audio). Null for monolingual docs. */
  translationContent: string | null;
  segments: AudioSegment[];
  metadata: DocumentMetadata;
  /** Drive file ID for the uploaded binary (audio, PDF). Null for plain text. */
  binaryAssetId: string | null;
  errorMessage: string | null;
}

export interface Code extends SyncableEntity {
  projectId: string;
  name: string;
  parentId: string | null;
  definition: string;
  color: string;
  provenance: CodeProvenance;
}

export interface Coding extends SyncableEntity {
  projectId: string;
  documentId: string;
  codeId: string;
  startOffset: number;
  endOffset: number;
  /** True when this coding is on the translation track rather than the original content. */
  isTranslation: boolean;
  /** Points to the corresponding coding in the other language track. */
  linkedCodingId: string | null;
  /** Denormalized snippet for export and search. */
  quotedText: string;
}

export interface Memo extends SyncableEntity {
  projectId: string;
  targetType: MemoTargetType;
  targetId: string;
  content: string;
}

export interface BinaryAsset extends SyncableEntity {
  documentId: string;
  blob: Blob;
  mimeType: string;
  driveFileId: string | null;
}

export interface SyncMeta {
  entityType: string;
  lastSyncedAt: Date;
  driveFileId: string | null;
}
