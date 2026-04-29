/**
 * API route proxy for Reducto document parsing.
 *
 * Accepts a base64-encoded file from the client, uploads it to Reducto,
 * and returns the parsed markdown content. The client sends its BYO
 * Reducto API key via the X-Reducto-Key header.
 */

import { NextRequest, NextResponse } from "next/server";
import { ReductoParseResultSchema } from "@/types/reducto";
import type { ApiErrorResponse } from "@/types/api";

// Allow large request bodies for document uploads (up to 50MB)
export const config = {
  api: { bodyParser: { sizeLimit: "50mb" } },
};

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-reducto-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing Reducto API key", code: "auth", retryable: false } satisfies ApiErrorResponse,
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { fileBase64, fileName, mimeType, extractionMode } = body;

    if (!fileBase64 || !fileName) {
      return NextResponse.json(
        { error: "Missing file data", code: "validation", retryable: false } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Step 1: Upload the file to Reducto
    const fileBuffer = Buffer.from(fileBase64, "base64");
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);

    const uploadRes = await fetch("https://platform.reducto.ai/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      if (uploadRes.status === 401) {
        return NextResponse.json(
          { error: "Invalid Reducto API key", code: "auth", retryable: false } satisfies ApiErrorResponse,
          { status: 401 }
        );
      }
      if (uploadRes.status === 429) {
        return NextResponse.json(
          { error: "Reducto rate limit exceeded", code: "rate_limit", retryable: true } satisfies ApiErrorResponse,
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Reducto upload failed: ${errText}`, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const uploadResult = await uploadRes.json();
    const fileId = uploadResult.file_id;

    // Step 2: Parse the uploaded file
    const isScannedOrHandwritten =
      mimeType.startsWith("image/") || extractionMode === "ocr";

    const parseBody: Record<string, unknown> = {
      input: fileId,
      settings: {
        ocr_system: "standard",
        extraction_mode: isScannedOrHandwritten ? "ocr" : (extractionMode ?? "hybrid"),
        return_images: ["figure"],
      },
      enhance: {
        summarize_figures: true,
        // Agentic text enhancement for handwritten/faded/scanned documents
        ...(isScannedOrHandwritten && {
          agentic: [{ scope: "text" }],
        }),
      },
    };

    const parseRes = await fetch("https://platform.reducto.ai/parse", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parseBody),
    });

    if (!parseRes.ok) {
      const errText = await parseRes.text();
      return NextResponse.json(
        { error: `Reducto parse failed: ${errText}`, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const parseResult = await parseRes.json();
    const validated = ReductoParseResultSchema.safeParse(parseResult.result ?? parseResult);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Unexpected Reducto response format", code: "validation", retryable: false } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    // Combine all chunks into a single markdown string
    const markdown = validated.data.chunks
      .map((chunk) => chunk.content)
      .join("\n\n");

    return NextResponse.json({ markdown, chunks: validated.data.chunks });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal error",
        code: "upstream_error",
        retryable: true,
      } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
