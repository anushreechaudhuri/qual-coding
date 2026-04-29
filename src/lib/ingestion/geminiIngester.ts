/**
 * Orchestrates audio transcription via Gemini API.
 *
 * Uses chunked transcription: processes audio in ~5 minute windows
 * sequentially, building the transcript progressively. Speaker labels
 * from earlier chunks are passed to later ones for consistency.
 *
 * The document updates after each chunk, so the user sees the transcript
 * building up in real time.
 */

import { getApiKey } from "@/lib/settings";
import { getBinaryAsset, updateDocument, ensureSpeakersFromSegments } from "@/lib/db/operations";
import { isApiError } from "@/types/api";
import type { AudioSegment } from "@/types";

const CHUNK_MINUTES = 5;
const DIRECT_UPLOAD_THRESHOLD_MB = 20;

/**
 * Upload a file directly from the browser to Gemini's resumable Files API,
 * bypassing the Next.js server proxy. Used for large files that would
 * otherwise time out going through the server.
 */
async function directUploadToGemini(
  blob: Blob,
  mimeType: string,
  apiKey: string
): Promise<string> {
  // Step 1: Start resumable upload
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": blob.size.toString(),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: { displayName: "audio" },
      }),
    }
  );

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Gemini upload start failed: ${errText}`);
  }

  const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("No upload URL returned from Gemini");
  }

  // Step 2: Upload the file data
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      "Content-Length": blob.size.toString(),
    },
    body: blob,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gemini file upload failed: ${errText}`);
  }

  const uploadResult = await uploadRes.json();
  const fileUri = uploadResult.file?.uri;

  if (!fileUri) {
    throw new Error("No file URI in upload response");
  }

  // Step 3: Poll until the file is ACTIVE (Gemini processes large files async)
  let fileState = uploadResult.file?.state;
  const fileName = uploadResult.file?.name;

  while (fileState === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const checkRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );

    if (checkRes.ok) {
      const checkResult = await checkRes.json();
      fileState = checkResult.state;
      if (fileState === "FAILED") {
        throw new Error("Gemini file processing failed");
      }
    }
  }

  return fileUri;
}

/**
 * Upload via the Next.js server proxy (original flow). Works well for
 * files under ~20MB where the browser fetch won't time out.
 */
async function proxyUploadToGemini(
  blob: Blob,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "audio");
  formData.append("mimeType", mimeType);

  const uploadRes = await fetch("/api/gemini/upload", {
    method: "POST",
    headers: { "X-Gemini-Key": apiKey },
    body: formData,
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => null);
    throw new Error(
      errData && isApiError(errData)
        ? errData.error
        : `File upload failed (${uploadRes.status})`
    );
  }

  const { uri } = await uploadRes.json();
  return uri;
}

/**
 * Upload a file to Gemini, choosing the right strategy based on size.
 * Files over 20MB go directly to Gemini's API from the browser.
 * Smaller files use the server proxy. If direct upload fails (e.g. CORS),
 * falls back to the server proxy.
 */
async function uploadToGemini(
  blob: Blob,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const fileSizeMB = blob.size / (1024 * 1024);

  if (fileSizeMB > DIRECT_UPLOAD_THRESHOLD_MB) {
    console.log(`[gemini] File is ${fileSizeMB.toFixed(1)}MB (>${DIRECT_UPLOAD_THRESHOLD_MB}MB), using direct upload`);
    try {
      return await directUploadToGemini(blob, mimeType, apiKey);
    } catch (err) {
      console.warn(
        "[gemini] Direct upload failed, falling back to server proxy:",
        err instanceof Error ? err.message : err
      );
      return await proxyUploadToGemini(blob, mimeType, apiKey);
    }
  }

  console.log(`[gemini] File is ${fileSizeMB.toFixed(1)}MB, using server proxy upload`);
  return await proxyUploadToGemini(blob, mimeType, apiKey);
}

export async function processWithGemini(
  documentId: string,
  binaryAssetId: string,
  language: string
): Promise<void> {
  const apiKey = getApiKey("gemini");
  if (!apiKey) {
    await updateDocument(documentId, {
      status: "error",
      errorMessage: "Gemini API key not configured. Add it in Settings.",
    });
    return;
  }

  const asset = await getBinaryAsset(binaryAssetId);
  if (!asset) {
    await updateDocument(documentId, {
      status: "error",
      errorMessage: "Audio file not found in local storage.",
    });
    return;
  }

  await updateDocument(documentId, { status: "processing" });

  try {
    const fileSizeMB = asset.blob.size / (1024 * 1024);
    console.log(`[gemini] File size: ${fileSizeMB.toFixed(1)}MB, mimeType: ${asset.mimeType}`);

    // Step 1: Upload to Files API
    console.log("[gemini] Uploading to Files API...");
    const uri = await uploadToGemini(asset.blob, asset.mimeType, apiKey);
    console.log("[gemini] Upload complete, URI:", uri);

    // Step 2: Estimate duration and plan chunks
    // Rough: 1MB ≈ 1.5 min of audio at typical compression
    const estimatedDurationMin = Math.max(5, Math.round(fileSizeMB * 1.5));
    const chunkCount = Math.ceil(estimatedDurationMin / CHUNK_MINUTES);
    console.log(`[gemini] Estimated ${estimatedDurationMin}min, processing in ${chunkCount} chunks`);

    // Step 3: Process chunks sequentially
    const allSegments: AudioSegment[] = [];
    let knownSpeakers: string[] = [];
    let globalSegmentIndex = 0;

    for (let chunk = 0; chunk < chunkCount; chunk++) {
      const startMin = chunk * CHUNK_MINUTES;
      const endMin = Math.min((chunk + 1) * CHUNK_MINUTES, estimatedDurationMin + 5);

      console.log(`[gemini] Chunk ${chunk + 1}/${chunkCount}: ${startMin}:00-${endMin}:00`);

      const chunkRes = await fetch("/api/gemini/transcribe-chunk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-Key": apiKey,
        },
        body: JSON.stringify({
          fileUri: uri,
          mimeType: asset.mimeType,
          language,
          startMin,
          endMin,
          knownSpeakers,
        }),
      });

      if (!chunkRes.ok) {
        const errData = await chunkRes.json().catch(() => null);
        const errMsg = errData && isApiError(errData) ? errData.error : `Chunk ${chunk + 1} failed`;
        console.error(`[gemini] Chunk ${chunk + 1} error:`, errMsg);

        // If we already have some segments, save what we have
        if (allSegments.length > 0) {
          console.log(`[gemini] Saving ${allSegments.length} segments from completed chunks`);
          break;
        }
        throw new Error(errMsg);
      }

      const result = await chunkRes.json();
      const chunkSegments = result.segments as Array<{
        speaker: string;
        timestamp: string;
        content: string;
        language: string;
        translation: string;
      }>;

      // Add segments with global indexing
      for (const seg of chunkSegments) {
        allSegments.push({
          index: globalSegmentIndex++,
          timestamp: seg.timestamp,
          endTimestamp: "",
          speaker: seg.speaker,
          content: seg.content,
          translation: seg.translation || seg.content,
          language: seg.language,
        });
      }

      // Update known speakers for next chunk
      if (result.speakers) {
        const newSpeakers = result.speakers as string[];
        for (const s of newSpeakers) {
          if (!knownSpeakers.includes(s)) knownSpeakers.push(s);
        }
      }

      // Update document progressively so user sees transcript building
      const content = allSegments
        .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.content}`)
        .join("\n\n");

      const translationContent =
        allSegments
          .filter((seg) => seg.translation && seg.translation !== seg.content)
          .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.translation}`)
          .join("\n\n") || null;

      await updateDocument(documentId, {
        status: "processing",
        content,
        translationContent,
        segments: allSegments,
        metadata: {
          originalFileName: "",
          fileSize: asset.blob.size,
          speakerCount: knownSpeakers.length,
        },
      });

      console.log(`[gemini] Chunk ${chunk + 1} done: +${chunkSegments.length} segments (total: ${allSegments.length})`);

      // If the chunk returned no segments, we've passed the end of the audio
      if (chunkSegments.length === 0) {
        console.log("[gemini] No segments in chunk, audio ended");
        break;
      }
    }

    // Fix end timestamps
    for (let i = 0; i < allSegments.length - 1; i++) {
      allSegments[i].endTimestamp = allSegments[i + 1].timestamp;
    }
    if (allSegments.length > 0) {
      allSegments[allSegments.length - 1].endTimestamp = allSegments[allSegments.length - 1].timestamp;
    }

    // Final update with status ready
    const content = allSegments
      .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.content}`)
      .join("\n\n");

    const translationContent =
      allSegments
        .filter((seg) => seg.translation && seg.translation !== seg.content)
        .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.translation}`)
        .join("\n\n") || null;

    await updateDocument(documentId, {
      status: "ready",
      content,
      translationContent,
      segments: allSegments,
      metadata: {
        originalFileName: "",
        fileSize: asset.blob.size,
        speakerCount: knownSpeakers.length,
      },
      errorMessage: null,
    });

    // Auto-create speaker entities from the transcript
    const doc = await import("@/lib/db/schema").then((m) => m.db.documents.get(documentId));
    if (doc) {
      await ensureSpeakersFromSegments(doc.projectId, knownSpeakers);
    }

    console.log(`[gemini] Complete: ${allSegments.length} segments, ${knownSpeakers.length} speakers`);
  } catch (err) {
    await updateDocument(documentId, {
      status: "error",
      errorMessage:
        err instanceof Error ? err.message : "Transcription failed unexpectedly",
    });
  }
}
