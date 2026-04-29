/**
 * Ingests plain text files (.txt, .md) directly into the database.
 * No external API call needed: the file content becomes the canonical
 * markdown content field as-is.
 */

import { createDocument, type CreateDocumentInput } from "@/lib/db/operations";
import type { DocumentPurpose } from "@/types";

export interface TextIngestionParams {
  file: File;
  projectId: string;
  purpose: DocumentPurpose;
  language: string;
  dateCollected: string;
  notes: string;
}

export async function ingestTextFile(params: TextIngestionParams) {
  const content = await params.file.text();

  const input: CreateDocumentInput = {
    projectId: params.projectId,
    title: params.file.name.replace(/\.(txt|md)$/i, ""),
    purpose: params.purpose,
    language: params.language,
    dateCollected: params.dateCollected,
    notes: params.notes,
    fileType: params.file.type || "text/plain",
    status: "ready",
    content,
    translationContent: null,
    segments: [],
    metadata: {
      originalFileName: params.file.name,
      fileSize: params.file.size,
    },
    binaryAssetId: null,
    errorMessage: null,
  };

  return createDocument(input);
}
