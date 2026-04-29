"use client";

import { useState } from "react";
import { createMemo, updateMemo } from "@/lib/db/operations";
import type { Memo, MemoTargetType } from "@/types";

export function MemoEditor({
  projectId,
  targetType,
  targetId,
  existingMemo,
  onClose,
}: {
  projectId: string;
  targetType: MemoTargetType;
  targetId: string;
  existingMemo?: Memo;
  onClose: () => void;
}) {
  const [content, setContent] = useState(existingMemo?.content ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      if (existingMemo) {
        await updateMemo(existingMemo.id, { content });
      } else {
        await createMemo({ projectId, targetType, targetId, content });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a memo..."
        rows={6}
        className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm font-serif focus:border-stone-400 focus:outline-none resize-y"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          {saving ? "Saving..." : existingMemo ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}
