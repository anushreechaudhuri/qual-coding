/**
 * Zod schemas for Reducto API responses.
 * Validates parsed document output before storing in IndexedDB.
 */

import { z } from "zod";

export const ReductoBlockSchema = z.object({
  type: z.string(),
  content: z.string(),
  bbox: z.object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

export const ReductoChunkSchema = z.object({
  content: z.string(),
  embed: z.string().optional(),
  blocks: z.array(ReductoBlockSchema).optional(),
});

export const ReductoParseResultSchema = z.object({
  chunks: z.array(ReductoChunkSchema),
});

export type ReductoParseResult = z.infer<typeof ReductoParseResultSchema>;

/**
 * Request body sent from the client to our API route proxy.
 * The file is sent as base64 to avoid multipart complexity in the proxy.
 */
export interface ReductoProxyRequest {
  fileBase64: string;
  fileName: string;
  mimeType: string;
  extractionMode?: "hybrid" | "ocr" | "metadata";
}
