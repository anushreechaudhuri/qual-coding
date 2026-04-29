/**
 * Background processing queue for pending documents.
 *
 * Documents uploaded without API keys or while offline get status "pending".
 * This queue checks for pending documents and processes them serially when
 * the required API key is available. Processing is serial to respect
 * upstream API rate limits.
 *
 * The queue runs on:
 * - App load (useProcessingQueue hook)
 * - After API key changes
 * - When connectivity is restored
 */

import { db } from "@/lib/db/schema";
import { routeFile } from "./fileRouter";
import { processWithReducto } from "./reductoIngester";
import { processWithGemini } from "./geminiIngester";
import { getApiKey } from "@/lib/settings";

let isProcessing = false;

export async function processNextPending(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pendingDocs = await db.documents
      .where("status")
      .equals("pending")
      .filter((d) => d.deletedAt === null && d.binaryAssetId !== null)
      .toArray();

    for (const doc of pendingDocs) {
      if (!doc.binaryAssetId) continue;

      // Determine which pipeline this document needs
      const pipeline = inferPipeline(doc.fileType);

      if (pipeline === "reducto" && !getApiKey("reducto")) continue;
      if (pipeline === "gemini" && !getApiKey("gemini")) continue;

      if (pipeline === "reducto") {
        await processWithReducto(doc.id, doc.binaryAssetId);
      } else if (pipeline === "gemini") {
        await processWithGemini(doc.id, doc.binaryAssetId, doc.language);
      }
    }
  } finally {
    isProcessing = false;
  }
}

function inferPipeline(fileType: string): "text" | "reducto" | "gemini" {
  if (fileType.startsWith("audio/")) return "gemini";
  if (fileType.startsWith("image/")) return "reducto";
  if (fileType === "application/pdf") return "reducto";
  if (fileType.includes("document") || fileType.includes("sheet")) return "reducto";
  return "text";
}
