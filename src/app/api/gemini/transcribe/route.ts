/**
 * API route for Gemini audio transcription.
 *
 * Uses raw fetch instead of the SDK to control timeouts for long
 * audio processing. Accepts either a fileUri (for pre-uploaded large
 * files) or inline base64 data (for small files).
 */

import { NextRequest, NextResponse } from "next/server";
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

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    segments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          speaker: { type: "STRING" },
          timestamp: { type: "STRING" },
          content: { type: "STRING" },
          language: { type: "STRING" },
          translation: { type: "STRING" },
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

    const prompt =
      TRANSCRIPTION_PROMPT +
      `\n\nThe primary language of this recording is ${language}. Pay special attention to accurate transcription in this language.`;

    // Build the request parts
    const parts: Record<string, unknown>[] = [{ text: prompt }];

    if (fileUri) {
      parts.push({ fileData: { mimeType: mimeType || "audio/mpeg", fileUri } });
    } else {
      parts.push({ inlineData: { mimeType, data: fileBase64 } });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    console.log("[gemini/transcribe] Calling generateContent...", {
      hasFileUri: !!fileUri,
      hasInlineData: !!fileBase64,
      mimeType,
      language,
    });

    // 10-minute timeout for long audio transcriptions
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[gemini/transcribe] API error:", geminiRes.status, errText);

      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return NextResponse.json(
          { error: "Invalid Gemini API key", code: "auth", retryable: false } satisfies ApiErrorResponse,
          { status: 401 }
        );
      }
      if (geminiRes.status === 429) {
        return NextResponse.json(
          { error: "Gemini rate limit exceeded. Try again in a few minutes.", code: "rate_limit", retryable: true } satisfies ApiErrorResponse,
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Gemini error (${geminiRes.status}): ${errText.slice(0, 300)}`, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const geminiResult = await geminiRes.json();
    console.log("[gemini/transcribe] Response received, parsing...");

    // Extract text from the Gemini response structure
    const responseText =
      geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error("[gemini/transcribe] No text in response:", JSON.stringify(geminiResult).slice(0, 500));
      return NextResponse.json(
        { error: "Gemini returned no transcription text", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const parsed = JSON.parse(responseText);
    const validated = TranscriptionResponseSchema.safeParse(parsed);

    if (!validated.success) {
      console.error("[gemini/transcribe] Schema validation failed:", validated.error.message);
      return NextResponse.json(
        { error: "Gemini response format mismatch", code: "validation", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const segments = validated.data.segments.map((seg, i) => ({
      ...seg,
      translation: seg.translation || seg.content,
      index: i,
    }));

    console.log(`[gemini/transcribe] Success: ${segments.length} segments`);
    return NextResponse.json({ segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[gemini/transcribe] Exception:", message);

    if (message.includes("aborted") || message.includes("abort")) {
      return NextResponse.json(
        { error: "Transcription timed out. The audio file may be too long. Try a shorter recording or split the file.", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: message, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
