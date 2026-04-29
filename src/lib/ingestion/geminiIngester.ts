/**
 * Orchestrates audio transcription via Gemini API.
 *
 * For large audio files (the norm for fieldwork interviews), we upload
 * directly to Gemini's Files API from the client, then call generateContent
 * with the file URI. This bypasses the Next.js API route body size limit.
 *
 * The BYO API key is used directly from localStorage since we're calling
 * from the client anyway.
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { getApiKey } from "@/lib/settings";
import { getBinaryAsset, updateDocument } from "@/lib/db/operations";
import type { AudioSegment } from "@/types";

const TRANSCRIPTION_PROMPT = `You are a transcription assistant. Transcribe the provided audio with the following requirements:

1. Identify and label each speaker (Speaker 1, Speaker 2, etc.)
2. Include timestamps in MM:SS format for each speaker turn
3. Transcribe in the original language exactly as spoken
4. Provide an English translation for each segment (if the segment is already in English, repeat it as the translation)
5. Detect the language of each segment

Be thorough and accurate. Preserve the original language text exactly as spoken, including any code-switching between languages.`;

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    segments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          speaker: { type: SchemaType.STRING },
          timestamp: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING },
          language: { type: SchemaType.STRING },
          translation: { type: SchemaType.STRING },
        },
        required: ["speaker", "timestamp", "content", "language", "translation"],
      },
    },
  },
  required: ["segments"],
};

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
    const genAI = new GoogleGenerativeAI(apiKey);

    // For files that fit in inline data (<20MB), send directly.
    // For larger files, we need the Files API which requires server-side upload.
    // Since the Files API client (GoogleAIFileManager) requires a server environment,
    // large files go through our API route which handles the upload.
    const fileSizeMB = asset.blob.size / (1024 * 1024);

    let fileData: { inlineData: { mimeType: string; data: string } } | { fileData: { mimeType: string; fileUri: string } };

    if (fileSizeMB <= 15) {
      // Small enough for inline data
      const buffer = await asset.blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      fileData = { inlineData: { mimeType: asset.mimeType, data: base64 } };
    } else {
      // Large file: upload via our API route that uses the Files API
      const uploadResult = await uploadLargeFile(apiKey, asset.blob, asset.mimeType);
      fileData = { fileData: { mimeType: asset.mimeType, fileUri: uploadResult.uri } };
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const prompt =
      TRANSCRIPTION_PROMPT +
      `\n\nThe primary language of this recording is ${language}. Pay special attention to accurate transcription in this language.`;

    const result = await model.generateContent([prompt, fileData]);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      throw new Error("Gemini response missing segments array");
    }

    const rawSegments = parsed.segments as Array<{
      speaker: string;
      timestamp: string;
      content: string;
      language: string;
      translation: string;
    }>;

    // Build AudioSegment array
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

    const translationContent = segments
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
    const message = err instanceof Error ? err.message : "Transcription failed unexpectedly";
    await updateDocument(documentId, {
      status: "error",
      errorMessage: message,
    });
  }
}

/**
 * Upload a large audio file to Gemini's Files API via our server-side route.
 * The Files API requires a server environment, so we proxy through a
 * dedicated upload endpoint.
 */
async function uploadLargeFile(
  apiKey: string,
  blob: Blob,
  mimeType: string
): Promise<{ uri: string }> {
  const formData = new FormData();
  formData.append("file", blob, "audio");
  formData.append("mimeType", mimeType);

  const response = await fetch("/api/gemini/upload", {
    method: "POST",
    headers: { "X-Gemini-Key": apiKey },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`File upload failed: ${errText}`);
  }

  return response.json();
}
