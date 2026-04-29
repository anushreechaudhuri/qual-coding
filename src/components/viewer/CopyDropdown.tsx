"use client";

import { useState } from "react";
import { db } from "@/lib/db/schema";
import type { Document } from "@/types";

export function CopyDropdown({ document: doc }: { document: Document }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCopy(format: string, withCodes: boolean) {
    try {
      const text = await buildCopyText(doc, format, withCodes);

      // Use a fallback approach: try Clipboard API, fall back to textarea trick
      const success = await copyToClipboard(text, format === "html");

      if (success) {
        setCopied(format + (withCodes ? "+codes" : ""));
        setTimeout(() => { setCopied(null); setOpen(false); }, 1500);
      }
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  if (copied) {
    return <span className="text-[10px] text-green-600 px-2 py-1">Copied</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded px-2.5 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50"
      >
        Copy ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-50 w-48 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
            <p className="px-3 py-1 text-[10px] font-medium text-stone-400 uppercase">Plain content</p>
            <CopyBtn label="Plain text" onClick={() => handleCopy("text", false)} />
            <CopyBtn label="Markdown" onClick={() => handleCopy("md", false)} />
            <CopyBtn label="Rich text (HTML)" onClick={() => handleCopy("html", false)} />

            <div className="border-t border-stone-100 my-1" />

            <p className="px-3 py-1 text-[10px] font-medium text-stone-400 uppercase">With code tags</p>
            <CopyBtn label="Plain text + codes" onClick={() => handleCopy("text", true)} />
            <CopyBtn label="JSON (coded)" onClick={() => handleCopy("json", true)} />
          </div>
        </>
      )}
    </div>
  );
}

function CopyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-1 text-left text-xs text-stone-600 hover:bg-stone-50"
    >
      {label}
    </button>
  );
}

/**
 * Robust clipboard copy that falls back to the textarea trick
 * when the Clipboard API isn't available or fails.
 */
async function copyToClipboard(text: string, asHtml: boolean): Promise<boolean> {
  // Try Clipboard API first
  try {
    if (asHtml && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([text], { type: "text/html" }),
          "text/plain": new Blob([stripHtml(text)], { type: "text/plain" }),
        }),
      ]);
      return true;
    }

    if (navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API failed, fall through to textarea fallback
  }

  // Fallback: textarea + execCommand
  const textarea = document.createElement("textarea");
  textarea.value = asHtml ? stripHtml(text) : text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

async function buildCopyText(
  doc: Document,
  format: string,
  withCodes: boolean
): Promise<string> {
  if (!withCodes) {
    if (format === "md") return doc.content;
    if (format === "html") return `<div>${doc.content.replace(/\n/g, "<br>")}</div>`;
    return doc.content;
  }

  const codings = await db.codings
    .where("documentId")
    .equals(doc.id)
    .filter((c) => c.deletedAt === null && !c.isTranslation)
    .toArray();

  const codeIds = [...new Set(codings.map((c) => c.codeId))];
  const codes = await Promise.all(codeIds.map((id) => db.codes.get(id)));
  const codeMap = new Map(codes.filter(Boolean).map((c) => [c!.id, c!]));

  if (format === "json") {
    const segments = codings
      .sort((a, b) => a.startOffset - b.startOffset)
      .map((c) => ({
        text: c.quotedText,
        code: codeMap.get(c.codeId)?.name ?? "unknown",
        start: c.startOffset,
        end: c.endOffset,
      }));

    return JSON.stringify({ title: doc.title, content: doc.content, codings: segments }, null, 2);
  }

  const sorted = codings.sort((a, b) => a.startOffset - b.startOffset);
  let result = "";
  let lastEnd = 0;

  for (const coding of sorted) {
    result += doc.content.slice(lastEnd, coding.startOffset);
    const codeName = codeMap.get(coding.codeId)?.name ?? "?";
    result += `${coding.quotedText} {${codeName}}`;
    lastEnd = coding.endOffset;
  }
  result += doc.content.slice(lastEnd);

  return result;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, " ");
}
