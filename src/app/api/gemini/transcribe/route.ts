/**
 * API route proxy for Gemini audio transcription.
 *
 * Accepts base64-encoded audio from the client, sends it to Gemini
 * with a prompt requesting speaker-diarized transcription with timestamps
 * and English translation. Uses structured JSON output (response_schema)
 * to enforce the segment format.
 *
 * The client sends its BYO Gemini API key via the X-Gemini-Key header.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type Schema, SchemaType } from "@google/generative-ai";
import { TranscriptionResponseSchema } from "@/types/gemini";
import type { ApiErrorResponse } from "@/types/api";

export const config = {
  api: { bodyParser: { sizeLimit: "50mb" } },
};

const TRANSCRIPTION_PROMPT = `You are a transcription assistant. Transcribe the provided audio with the following requirements:

1. Identify and label each speaker (Speaker 1, Speaker 2, etc.)
2. Include timestamps in MM:SS format for each speaker turn
3. Transcribe in the original language exactly as spoken
4. Provide an English translation for each segment (if the segment is already in English, repeat it as the translation)
5. Detect the language of each segment

Return the transcription as a JSON object with a "segments" array. Each segment should have: speaker, timestamp, content (original language), language (ISO code or name), and translation (English).

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
    const { fileBase64, mimeType, language } = body;

    if (!fileBase64 || !mimeType) {
      return NextResponse.json(
        { error: "Missing audio data", code: "validation", retryable: false } satisfies ApiErrorResponse,
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

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: fileBase64,
        },
      },
    ]);

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

    // Enforce 1:1 segment correspondence: every segment must have both
    // content and translation. Normalize any mismatches.
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
