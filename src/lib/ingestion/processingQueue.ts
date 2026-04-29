/**
 * Background processing queue for pending documents.
 *
 * Documents uploaded without API keys or while offline get status "pending".
 * This queue checks for pending documents and processes them serially when
 * the required API key is available.
 */

import { db } from "@/lib/db/schema";
import { processWithReducto } from "./reductoIngester";
import { processWithGemini } from "./geminiIngester";
import { getApiKey } from "@/lib/settings";

let isProcessing = false;

export async function processNextPending(): Promise<void> {
  if (isProcessing) {
    console.log("[queue] Already processing, skipping");
    return;
  }
  isProcessing = true;

  try {
    const pendingDocs = await db.documents
      .where("status")
      .equals("pending")
      .filter((d) => d.deletedAt === null && d.binaryAssetId !== null)
      .toArray();

    console.log(`[queue] Found ${pendingDocs.length} pending documents`);

    for (const doc of pendingDocs) {
      if (!doc.binaryAssetId) continue;

      const pipeline = inferPipeline(doc.fileType);
      console.log(`[queue] Document "${doc.title}" (${doc.fileType}) → ${pipeline} pipeline`);

      if (pipeline === "reducto" && !getApiKey("reducto")) {
        console.log("[queue] Skipping: no Reducto API key");
        continue;
      }
      if (pipeline === "gemini" && !getApiKey("gemini")) {
        console.log("[queue] Skipping: no Gemini API key");
        continue;
      }

      try {
        if (pipeline === "reducto") {
          console.log(`[queue] Processing "${doc.title}" with Reducto...`);
          await processWithReducto(doc.id, doc.binaryAssetId);
          console.log(`[queue] Reducto done for "${doc.title}"`);
        } else if (pipeline === "gemini") {
          console.log(`[queue] Processing "${doc.title}" with Gemini...`);
          await processWithGemini(doc.id, doc.binaryAssetId, doc.language);
          console.log(`[queue] Gemini done for "${doc.title}"`);
        }
      } catch (err) {
        console.error(`[queue] Error processing "${doc.title}":`, err);
      }
    }
  } finally {
    isProcessing = false;
    console.log("[queue] Processing complete");
  }
}

function inferPipeline(fileType: string): "text" | "reducto" | "gemini" {
  if (fileType.startsWith("audio/")) return "gemini";
  if (fileType.startsWith("image/")) return "reducto";
  if (fileType === "application/pdf") return "reducto";
  if (fileType.includes("document") || fileType.includes("sheet")) return "reducto";
  return "text";
}
