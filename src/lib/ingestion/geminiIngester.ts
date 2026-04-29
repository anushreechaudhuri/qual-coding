/**
 * Orchestrates audio transcription through the Gemini API route proxy.
 *
 * Reads the audio binary from IndexedDB, sends it to our API route
 * (which forwards to Gemini), and updates the document with the
 * transcribed segments, canonical content, and translation track.
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
    // Convert blob to base64
    const buffer = await asset.blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    const response = await fetch("/api/gemini/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gemini-Key": apiKey,
      },
      body: JSON.stringify({
        fileBase64: base64,
        mimeType: asset.mimeType,
        language,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const message =
        errorData && isApiError(errorData)
          ? errorData.error
          : `Transcription failed (${response.status})`;

      await updateDocument(documentId, {
        status: "error",
        errorMessage: message,
      });
      return;
    }

    const result = await response.json();
    const rawSegments = result.segments as Array<{
      speaker: string;
      timestamp: string;
      content: string;
      language: string;
      translation: string | null;
      index: number;
    }>;

    // Build AudioSegment array with end timestamps estimated from next segment
    const segments: AudioSegment[] = rawSegments.map((seg, i) => ({
      index: i,
      timestamp: seg.timestamp,
      endTimestamp: rawSegments[i + 1]?.timestamp ?? seg.timestamp,
      speaker: seg.speaker,
      content: seg.content,
      translation: seg.translation,
      language: seg.language,
    }));

    // Build canonical content by joining speaker-labeled segments
    const content = segments
      .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.content}`)
      .join("\n\n");

    // Build translation track
    const translationContent = segments
      .filter((seg) => seg.translation)
      .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.translation}`)
      .join("\n\n") || null;

    // Count unique speakers
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
