/**
 * Chunked transcription: transcribe a specific time window of an audio file.
 *
 * The client calls this multiple times with different startMin/endMin values,
 * building the transcript progressively. After the first chunk, known speakers
 * are passed to maintain consistency.
 */

import { NextRequest, NextResponse } from "next/server";
import { TranscriptionResponseSchema } from "@/types/gemini";
import type { ApiErrorResponse } from "@/types/api";

export const maxDuration = 300;

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
    const { fileUri, mimeType, language, startMin, endMin, knownSpeakers } = body;

    if (!fileUri) {
      return NextResponse.json(
        { error: "Missing fileUri", code: "validation", retryable: false } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    const speakerContext = knownSpeakers?.length
      ? `\n\nSpeakers identified so far: ${knownSpeakers.join(", ")}. Use the SAME labels for the same voices.`
      : "";

    const prompt = `Transcribe ONLY the portion of this audio from ${startMin}:00 to ${endMin}:00 (minutes:seconds).

Requirements:
1. Label each speaker by role when possible (Interviewer, Farmer 1, Farmer 2, Translator, etc.). Be consistent with labels.
2. Timestamps in MM:SS format, starting from the actual position in the recording (not from 00:00).
3. Transcribe in the original language exactly as spoken, preserving code-switching.
4. Provide an English translation for each segment.
5. Detect the language of each segment.${speakerContext}

The primary language is ${language}. Be thorough and accurate. These are research recordings.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { fileData: { mimeType: mimeType || "audio/mp4", fileUri } },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    console.log(`[gemini/chunk] Transcribing ${startMin}:00-${endMin}:00...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);

    let geminiRes: Response;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : "fetch failed";
      console.error(`[gemini/chunk] Fetch failed for ${startMin}-${endMin}:`, msg);
      return NextResponse.json(
        { error: `Connection failed: ${msg}`, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    clearTimeout(timeout);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`[gemini/chunk] API error ${geminiRes.status}:`, errText.slice(0, 200));
      return NextResponse.json(
        { error: `Gemini error (${geminiRes.status}): ${errText.slice(0, 200)}`, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const result = await geminiRes.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return NextResponse.json(
        { error: "No transcription text returned", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Try recovery
      const lastTranslation = responseText.lastIndexOf('"translation"');
      if (lastTranslation > 0) {
        let braceDepth = 0;
        for (let i = lastTranslation; i < responseText.length; i++) {
          if (responseText[i] === "{") braceDepth++;
          if (responseText[i] === "}") {
            braceDepth--;
            if (braceDepth <= 0) {
              try {
                parsed = JSON.parse(responseText.slice(0, i + 1) + "]}");
                break;
              } catch { /* continue */ }
            }
          }
        }
      }
      if (!parsed) {
        return NextResponse.json(
          { error: "Malformed JSON in chunk response", code: "validation", retryable: true } satisfies ApiErrorResponse,
          { status: 502 }
        );
      }
    }

    const validated = TranscriptionResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Response format mismatch", code: "validation", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const segments = validated.data.segments.map((seg, i) => ({
      ...seg,
      translation: seg.translation || seg.content,
      index: i,
    }));

    const speakers = [...new Set(segments.map((s) => s.speaker))];
    console.log(`[gemini/chunk] ${startMin}-${endMin}: ${segments.length} segments, speakers: ${speakers.join(", ")}`);

    return NextResponse.json({ segments, speakers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chunk transcription failed";
    console.error("[gemini/chunk] Exception:", message);
    return NextResponse.json(
      { error: message, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
