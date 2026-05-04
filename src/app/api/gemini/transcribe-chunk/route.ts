/**
 * Chunked transcription: transcribe a specific time window of an audio file.
 *
 * Uses gemini-2.5-flash (full thinking model) for best quality.
 * Does NOT force a response schema — asks for JSON in the prompt instead,
 * which produces much better speaker identification and segment grouping.
 */

import { NextRequest, NextResponse } from "next/server";
import { TranscriptionResponseSchema } from "@/types/gemini";
import type { ApiErrorResponse } from "@/types/api";

export const maxDuration = 300;

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
      ? `\nSpeakers identified in previous chunks: ${knownSpeakers.join(", ")}. Use the SAME labels for the same voices. Distinguish carefully between different speakers.`
      : "";

    const prompt = `Transcribe ONLY the audio from ${startMin}:00 to ${endMin}:00.

This is a qualitative research recording (focus group discussion or interview) conducted primarily in ${language}. Accuracy is critical for research analysis.

Rules:
1. Group by SPEAKER TURNS. Each segment = everything one person says before the next person speaks. Do NOT split one speaker's continuous speech into tiny fragments.
2. Identify speakers by name or role (e.g., Tasin, Anushree, Farmer 1, Farmer 2, Translator). Listen carefully to distinguish different voices.
3. Timestamps in MM:SS format matching the actual recording position.
4. Transcribe in the ORIGINAL language exactly as spoken. Preserve code-switching between languages.
5. For each segment, provide a COMPLETE English translation — full translation, not a summary.
6. Language code for each segment (bn, en, hi, id, etc.).${speakerContext}

Return valid JSON with this exact structure:
{"segments": [{"speaker": "Name", "timestamp": "MM:SS", "content": "original language text", "language": "bn", "translation": "English translation"}]}

IMPORTANT: Quality over quantity. Fewer long segments grouped by speaker turns are much better than many tiny fragments.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { fileData: { mimeType: mimeType || "audio/mp4", fileUri } },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    console.log(`[gemini/chunk] Transcribing ${startMin}:00-${endMin}:00 with gemini-2.5-flash...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);

    let geminiRes: Response;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
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

    // Parse SSE stream: collect all text parts
    const sseText = await geminiRes.text();
    let responseText = "";

    for (const line of sseText.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") break;
      try {
        const chunk = JSON.parse(data);
        const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (part) responseText += part;
      } catch {
        // skip malformed SSE lines
      }
    }

    console.log(`[gemini/chunk] ${startMin}-${endMin}: received ${responseText.length} chars`);

    if (!responseText) {
      return NextResponse.json(
        { error: "No transcription text returned", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    // Parse the JSON response (not schema-enforced, so may need cleanup)
    let parsed: unknown;
    try {
      // Try direct parse first
      parsed = JSON.parse(responseText);
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = responseText.match(/```json?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
      }

      // Try recovery: find last complete segment
      if (!parsed) {
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
      }

      if (!parsed) {
        console.error("[gemini/chunk] JSON parse failed, text:", responseText.slice(0, 300));
        return NextResponse.json(
          { error: "Malformed JSON in response", code: "validation", retryable: true } satisfies ApiErrorResponse,
          { status: 502 }
        );
      }
    }

    const validated = TranscriptionResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[gemini/chunk] Schema validation failed:", validated.error.message);
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
