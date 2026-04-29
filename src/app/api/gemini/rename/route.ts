/**
 * AI-powered document rename. Sends the first ~2000 characters of content
 * to Gemini and asks for a concise, descriptive title.
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
    const { content, currentTitle, purpose, language } = await req.json();

    const prompt = `You are helping a qualitative researcher organize their documents. Given the following document content, suggest a short, descriptive title (3-8 words). The title should capture the key topic or subject of the document.

Current title: "${currentTitle}"
Document purpose: ${purpose}
Language: ${language}

Document content (first 2000 chars):
${content}

Respond with ONLY the suggested title, nothing else. No quotes, no explanation.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Gemini rename failed", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
        { status: 502 }
      );
    }

    const result = await res.json();
    const title = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return NextResponse.json({ title: title || currentTitle });
  } catch {
    return NextResponse.json(
      { error: "Rename failed", code: "upstream_error", retryable: true } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
