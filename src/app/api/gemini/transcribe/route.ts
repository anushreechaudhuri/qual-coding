/**
 * API route proxy for Gemini audio transcription.
 *
 * Accepts either:
 *   - fileUri (from the /api/gemini/upload step, for large files)
 *   - fileBase64 + mimeType (for small files, inline data)
 *
 * Calls generateContent server-side to avoid browser fetch issues
 * with long-running Gemini requests.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type Schema, SchemaType } from "@google/generative-ai";
import { TranscriptionResponseSchema } from "@/types/gemini";
import type { ApiErrorResponse } from "@/types/api";

export const maxDuration = 300;

const TRANSCRIPTION_PROMPT = `You are a transcription assistant for qualitative research interviews and focus group discussions. Transcribe the provided audio with the following requirements:

1. Identify each distinct speaker. Try to label them by their apparent role when contextual cues allow (e.g., "Interviewer", "Farmer 1", "Farmer 2", "Translator", "Village Elder", "Respondent 1"). If no role is apparent, use "Speaker 1", "Speaker 2", etc. Be consistent: the same voice should always get the same label throughout.
2. Include timestamps in MM:SS format for each speaker turn.
3. Transcribe in the original language exactly as spoken. Preserve code-switching (e.g., mixing Bangla and English in the same sentence).
4. Provide an English translation for each segment. If the segment is already in English, repeat it as the translation.
5. Detect the language of each segment (e.g., "bn" for Bangla, "en" for English, "hi" for Hindi, "id" for Indonesian).

Be thorough and accurate. These are research recordings where exact wording matters for qualitative analysis.`;

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

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-gemini-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing Gemini API key", code: "auth", retryable: false } satisfies ApiErrorResponse,
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { fileBase64, fileUri, mimeType, language } = body;

    if (!fileUri && !fileBase64) {
      return NextResponse.json(
        { error: "Missing audio data (need fileUri or fileBase64)", code: "validation", retryable: false } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
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

    // Build the file part: either a URI reference or inline base64
    const filePart = fileUri
      ? { fileData: { mimeType: mimeType || "audio/mpeg", fileUri } }
      : { inlineData: { mimeType, data: fileBase64 } };

    const result = await model.generateContent([prompt, filePart]);

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    const validated = TranscriptionResponseSchema.safeParse(parsed);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Gemini response did not match expected segment format",
          code: "validation",
          retryable: true,
        } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const segments = validated.data.segments.map((seg, i) => ({
      ...seg,
      translation: seg.translation || seg.content,
      index: i,
    }));

    return NextResponse.json({ segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";

    if (message.includes("API_KEY_INVALID") || message.includes("401")) {
      return NextResponse.json(
        { error: "Invalid Gemini API key", code: "auth", retryable: false } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    if (message.includes("429") || message.includes("RATE_LIMIT")) {
      return NextResponse.json(
        { error: "Gemini rate limit exceeded", code: "rate_limit", retryable: true } satisfies ApiErrorResponse,
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: message, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
