/**
 * Zod schemas for Gemini transcription responses.
 * Validates that the structured JSON output matches our expected segment format.
 */

import { z } from "zod";

export const TranscriptionSegmentSchema = z.object({
  speaker: z.string(),
  timestamp: z.string(),
  content: z.string(),
  language: z.string().optional().default("unknown"),
  translation: z.string().nullable().optional().default(null),
});

export const TranscriptionResponseSchema = z.object({
  segments: z.array(TranscriptionSegmentSchema),
});

export type TranscriptionSegment = z.infer<typeof TranscriptionSegmentSchema>;
export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;

/**
 * Request body sent from the client to our API route proxy.
 */
export interface GeminiTranscribeRequest {
  fileBase64: string;
  mimeType: string;
  language: string;
}
