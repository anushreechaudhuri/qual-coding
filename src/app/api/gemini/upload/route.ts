/**
 * Server-side route for uploading large audio files to Gemini's Files API.
 *
 * The Files API requires server-side access (GoogleAIFileManager).
 * The client sends the raw file as FormData; this route uploads it
 * to Gemini and returns the file URI for use in generateContent.
 */

import { NextRequest, NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/types/api";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-gemini-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing Gemini API key", code: "auth", retryable: false } satisfies ApiErrorResponse,
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mimeType = formData.get("mimeType") as string | null;

    if (!file || !mimeType) {
      return NextResponse.json(
        { error: "Missing file or mimeType", code: "validation", retryable: false } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }

    // Upload to Gemini Files API using the REST endpoint directly
    // Step 1: Start resumable upload
    const startRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": file.size.toString(),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: { displayName: file.name || "audio" },
        }),
      }
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      return NextResponse.json(
        { error: `Gemini upload start failed: ${errText}`, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
      return NextResponse.json(
        { error: "No upload URL returned from Gemini", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    // Step 2: Upload the file data
    const fileBuffer = await file.arrayBuffer();
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
        "Content-Length": file.size.toString(),
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return NextResponse.json(
        { error: `Gemini file upload failed: ${errText}`, code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const uploadResult = await uploadRes.json();
    const fileUri = uploadResult.file?.uri;

    if (!fileUri) {
      return NextResponse.json(
        { error: "No file URI in upload response", code: "upstream_error", retryable: false } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    // Step 3: Wait for file processing (Gemini needs time for large files)
    let fileState = uploadResult.file?.state;
    const fileName = uploadResult.file?.name;

    while (fileState === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const checkRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
      );

      if (checkRes.ok) {
        const checkResult = await checkRes.json();
        fileState = checkResult.state;
        if (fileState === "FAILED") {
          return NextResponse.json(
            { error: "Gemini file processing failed", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
            { status: 502 }
          );
        }
      }
    }

    return NextResponse.json({ uri: fileUri });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Upload failed",
        code: "upstream_error",
        retryable: true,
      } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
