/**
 * Orchestrates audio transcription via Gemini API.
 *
 * All Gemini API calls go through server-side routes to avoid browser
 * fetch timeouts and CORS issues with long-running requests:
 *
 *   Small files (<15MB): POST /api/gemini/transcribe with inline base64
 *   Large files (>15MB): POST /api/gemini/upload → get fileUri
 *                        POST /api/gemini/transcribe with fileUri
 */

import { getApiKey } from "@/lib/settings";
import { getBinaryAsset, updateDocument } from "@/lib/db/operations";
import { isApiError } from "@/types/api";
import type { AudioSegment } from "@/types";

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
    let transcribeBody: Record<string, string>;

    if (fileSizeMB <= 15) {
      console.log("[gemini] Using inline base64 (small file)");
      // Small file: send as inline base64
      const buffer = await asset.blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      transcribeBody = {
        fileBase64: base64,
        mimeType: asset.mimeType,
        language,
      };
    } else {
      console.log("[gemini] Using Files API upload (large file)");
      // Large file: upload first via Files API, then transcribe with URI
      const formData = new FormData();
      formData.append("file", asset.blob, "audio");
      formData.append("mimeType", asset.mimeType);

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
      console.log("[gemini] Upload complete, URI:", uri);
      transcribeBody = {
        fileUri: uri,
        mimeType: asset.mimeType,
        language,
      };
    }

    console.log("[gemini] Calling transcribe route...");
    // Call transcribe route (server-side generateContent)
    const transcribeRes = await fetch("/api/gemini/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gemini-Key": apiKey,
      },
      body: JSON.stringify(transcribeBody),
    });

    if (!transcribeRes.ok) {
      const errData = await transcribeRes.json().catch(() => null);
      throw new Error(
        errData && isApiError(errData)
          ? errData.error
          : `Transcription failed (${transcribeRes.status})`
      );
    }

    const result = await transcribeRes.json();
    const rawSegments = result.segments as Array<{
      speaker: string;
      timestamp: string;
      content: string;
      language: string;
      translation: string;
      index: number;
    }>;

    const segments: AudioSegment[] = rawSegments.map((seg, i) => ({
      index: i,
      timestamp: seg.timestamp,
      endTimestamp: rawSegments[i + 1]?.timestamp ?? seg.timestamp,
      speaker: seg.speaker,
      content: seg.content,
      translation: seg.translation || seg.content,
      language: seg.language,
    }));

    const content = segments
      .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.content}`)
      .join("\n\n");

    const translationContent =
      segments
        .filter((seg) => seg.translation && seg.translation !== seg.content)
        .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.translation}`)
        .join("\n\n") || null;

    const speakerCount = new Set(segments.map((s) => s.speaker)).size;

    await updateDocument(documentId, {
      status: "ready",
      content,
      translationContent,
      segments,
      metadata: {
        originalFileName: "",
        fileSize: asset.blob.size,
        speakerCount,
      },
      errorMessage: null,
    });
  } catch (err) {
    await updateDocument(documentId, {
      status: "error",
      errorMessage:
        err instanceof Error ? err.message : "Transcription failed unexpectedly",
    });
  }
}
