"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { deleteMemo } from "@/lib/db/operations";
import { MemoEditor } from "./MemoEditor";
import type { Memo, MemoTargetType } from "@/types";

export function MemoList({
  targetType,
  targetId,
}: {
  targetType: MemoTargetType;
  targetId: string;
}) {
  const memos = useLiveQuery(
    () =>
      db.memos
        .where("[targetType+targetId]")
        .equals([targetType, targetId])
        .filter((m) => m.deletedAt === null)
        .toArray(),
    [targetType, targetId]
  );

  if (!memos || memos.length === 0) return null;

  return (
    <div className="space-y-2">
      {memos.map((memo) => (
        <MemoCard
          key={memo.id}
          memo={memo}
          onDelete={() => deleteMemo(memo.id)}
        />
      ))}
    </div>
  );
}

function MemoCard({
  memo,
  onDelete,
}: {
  memo: Memo;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const content = memo.content;
  const date = memo.updatedAt instanceof Date ? memo.updatedAt : new Date(memo.updatedAt);

  function stripHtml(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent ?? "";
  }

  async function copyAs(format: "text" | "html" | "md") {
    let text: string;
    switch (format) {
      case "text":
        text = stripHtml(content);
        break;
      case "html":
        text = content;
        break;
      case "md":
        text = htmlToMarkdown(content);
        break;
    }

    try {
      if (format === "html") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([text], { type: "text/html" }),
            "text/plain": new Blob([stripHtml(content)], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(format);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  if (editing) {
    return (
      <div className="rounded border border-stone-200 bg-white p-3">
        <MemoEditor
          projectId={memo.projectId}
          targetType={memo.targetType}
          targetId={memo.targetId}
          existingMemo={memo}
          onClose={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded border border-stone-100 bg-stone-50 p-3">
      <div
        className="text-sm font-serif text-stone-700 prose prose-sm prose-stone max-w-none cursor-pointer hover:bg-stone-100 rounded p-1 -m-1"
        dangerouslySetInnerHTML={{ __html: content }}
        onClick={() => setEditing(true)}
        title="Click to edit"
      />
      <div className="mt-2 flex items-center justify-between text-[10px] text-stone-400">
        <span>{date.toLocaleDateString()}</span>
        <div className="flex gap-1.5">
          {copied ? (
            <span className="text-green-600">copied {copied}</span>
          ) : (
            <>
              <button onClick={() => copyAs("text")} className="hover:text-stone-600" title="Copy as plain text">text</button>
              <button onClick={() => copyAs("html")} className="hover:text-stone-600" title="Copy as rich text">rich</button>
              <button onClick={() => copyAs("md")} className="hover:text-stone-600" title="Copy as markdown">md</button>
            </>
          )}
          <span className="text-stone-200">|</span>
          <button onClick={() => setEditing(true)} className="hover:text-stone-600">edit</button>
          <button onClick={onDelete} className="hover:text-red-500">delete</button>
        </div>
      </div>
    </div>
  );
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<b>(.*?)<\/b>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<i>(.*?)<\/i>/g, "*$1*")
    .replace(/<li>(.*?)<\/li>/g, "- $1\n")
    .replace(/<blockquote>(.*?)<\/blockquote>/g, "> $1")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<p>(.*?)<\/p>/g, "$1\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
