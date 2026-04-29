/**
 * Routes uploaded files to the correct ingestion pipeline based on MIME type.
 *
 * Audio  → Gemini pipeline (Unit 6)
 * PDF / images / spreadsheets → Reducto pipeline (Unit 5)
 * Text   → inline text ingester (this unit)
 */

export type IngestionPipeline = "text" | "reducto" | "gemini";

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/webm",
]);

const REDUCTO_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/tiff",
  "image/gif",
  "image/bmp",
  "image/webp",
  "image/heic",
]);

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

export function routeFile(file: File): IngestionPipeline {
  const mime = file.type.toLowerCase();

  if (AUDIO_TYPES.has(mime)) return "gemini";
  if (REDUCTO_TYPES.has(mime)) return "reducto";
  if (IMAGE_TYPES.has(mime)) return "reducto";
  if (TEXT_TYPES.has(mime)) return "text";

  // Fallback: check file extension when MIME is missing or generic
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (["mp3", "wav", "m4a", "ogg", "flac", "aac", "webm"].includes(ext))
    return "gemini";
  if (["pdf", "docx", "doc", "xlsx", "xls", "csv", "pptx"].includes(ext))
    return "reducto";
  if (["png", "jpg", "jpeg", "tiff", "gif", "bmp", "webp", "heic"].includes(ext))
    return "reducto";
  if (["txt", "md"].includes(ext)) return "text";

  return "text";
}

/**
 * File types accepted by the upload input.
 */
export const ACCEPTED_FILE_TYPES =
  "audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/flac,.mp3,.wav,.m4a,.ogg,.flac," +
  "application/pdf,.pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx," +
  "image/png,image/jpeg,image/tiff,.png,.jpg,.jpeg,.tiff," +
  "text/plain,text/markdown,.txt,.md";
