"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { createMemo, updateMemo } from "@/lib/db/operations";
import { db } from "@/lib/db/schema";
import type { Memo, MemoTargetType } from "@/types";

/**
 * Rich text memo editor with @ mentions for linking to documents,
 * codes, and projects. Uses Tiptap for editing.
 */
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
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write a memo... Use @ to link documents, codes, or projects",
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: {
          items: async ({ query }: { query: string }) => {
            return searchMentionables(projectId, query);
          },
          render: () => {
            let component: HTMLDivElement | null = null;
            let onSelect: ((item: MentionItem) => void) | null = null;

            return {
              onStart: (props: MentionSuggestionProps) => {
                component = document.createElement("div");
                component.className =
                  "absolute z-50 w-56 rounded-md border border-stone-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto";
                document.body.appendChild(component);
                updatePosition(component, props.clientRect);
                onSelect = (item: MentionItem) => {
                  props.command({ id: item.id, label: item.label });
                };
                renderItems(component, props.items as MentionItem[], onSelect);
              },
              onUpdate: (props: MentionSuggestionProps) => {
                if (!component) return;
                updatePosition(component, props.clientRect);
                onSelect = (item: MentionItem) => {
                  props.command({ id: item.id, label: item.label });
                };
                renderItems(component, props.items as MentionItem[], onSelect);
              },
              onExit: () => {
                component?.remove();
                component = null;
              },
              onKeyDown: (props: { event: KeyboardEvent }) => {
                if (props.event.key === "Escape") {
                  component?.remove();
                  component = null;
                  return true;
                }
                return false;
              },
            };
          },
        },
      }),
    ],
    content: existingMemo?.content ?? "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-stone max-w-none focus:outline-none min-h-[80px] px-3 py-2 text-sm",
      },
    },
  });

  async function handleSave() {
    if (!editor) return;
    const content = editor.getHTML();
    if (!content.replace(/<[^>]*>/g, "").trim()) return;

    setSaving(true);
    try {
      if (existingMemo) {
        await updateMemo(existingMemo.id, { content });
      } else {
        await createMemo({ projectId, targetType, targetId, content });
      }
      editor.commands.clearContent();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-stone-200 bg-white">
        {/* Toolbar */}
        {editor && (
          <div className="flex gap-0.5 border-b border-stone-100 px-2 py-1">
            <ToolbarButton
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
              label="B"
              title="Bold"
              bold
            />
            <ToolbarButton
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              label="I"
              title="Italic"
              italic
            />
            <ToolbarButton
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              label="•"
              title="Bullet list"
            />
            <ToolbarButton
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              label="❝"
              title="Quote"
            />
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          {saving ? "Saving..." : existingMemo ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  title,
  bold,
  italic,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-xs ${
        active
          ? "bg-stone-200 text-stone-900"
          : "text-stone-500 hover:bg-stone-100"
      } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""}`}
      title={title}
    >
      {label}
    </button>
  );
}

// @ mention support

interface MentionItem {
  id: string;
  label: string;
  type: "document" | "code" | "project";
}

interface MentionSuggestionProps {
  items: unknown[];
  command: (attrs: { id: string; label: string }) => void;
  clientRect?: (() => DOMRect | null) | null;
}

async function searchMentionables(
  projectId: string,
  query: string
): Promise<MentionItem[]> {
  const q = query.toLowerCase();
  const results: MentionItem[] = [];

  const [docs, codes, projects] = await Promise.all([
    db.documents
      .where("projectId")
      .equals(projectId)
      .filter((d) => d.deletedAt === null)
      .toArray(),
    db.codes
      .where("projectId")
      .equals(projectId)
      .filter((c) => c.deletedAt === null)
      .toArray(),
    db.projects.filter((p) => p.deletedAt === null).toArray(),
  ]);

  for (const doc of docs) {
    if (doc.title.toLowerCase().includes(q)) {
      results.push({ id: doc.id, label: doc.title, type: "document" });
    }
  }
  for (const code of codes) {
    if (code.name.toLowerCase().includes(q)) {
      results.push({ id: code.id, label: code.name, type: "code" });
    }
  }
  for (const project of projects) {
    if (project.name.toLowerCase().includes(q)) {
      results.push({ id: project.id, label: project.name, type: "project" });
    }
  }

  return results.slice(0, 10);
}

function updatePosition(
  el: HTMLElement,
  clientRect: (() => DOMRect | null) | null | undefined
) {
  if (!clientRect) return;
  const rect = clientRect();
  if (!rect) return;
  el.style.position = "fixed";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + 4}px`;
}

function renderItems(
  container: HTMLElement,
  items: MentionItem[],
  onSelect: ((item: MentionItem) => void) | null
) {
  const typeIcons: Record<string, string> = {
    document: "📄",
    code: "🏷",
    project: "📁",
  };

  container.innerHTML = items.length
    ? items
        .map(
          (item, i) =>
            `<button data-index="${i}" class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-stone-50">
              <span class="text-xs">${typeIcons[item.type] ?? ""}</span>
              <span class="truncate">${item.label}</span>
              <span class="ml-auto text-[10px] text-stone-400">${item.type}</span>
            </button>`
        )
        .join("")
    : '<p class="px-3 py-2 text-xs text-stone-400">No matches</p>';

  container.querySelectorAll("button[data-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index") ?? "0");
      if (items[idx] && onSelect) onSelect(items[idx]);
    });
  });
}
