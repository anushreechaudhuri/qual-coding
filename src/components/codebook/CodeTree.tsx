"use client";

import { useState } from "react";
import type { Code } from "@/types";
import { type CodeTreeNode, buildCodeTree } from "@/hooks/useCodebook";
import { updateCode, deleteCode } from "@/lib/db/operations";

const PROVENANCE_LABELS: Record<string, string> = {
  user: "you",
  ai: "AI",
  ai_edited: "AI·edited",
  imported: "imported",
};

/**
 * Hierarchical code tree with expand/collapse, inline rename,
 * and delete. Each code shows name, color, provenance badge,
 * and coded segment count.
 */
export function CodeTree({
  codes,
  selectedCodeId,
  onSelect,
  codingCounts,
}: {
  codes: Code[];
  selectedCodeId: string | null;
  onSelect: (id: string) => void;
  codingCounts: Record<string, number>;
}) {
  const tree = buildCodeTree(codes);

  if (codes.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-stone-400">No codes yet.</p>
        <p className="mt-1 text-xs text-stone-400">
          Create your first code to start coding documents.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-px py-1">
      {tree.map((node) => (
        <TreeNode
          key={node.code.id}
          node={node}
          depth={0}
          selectedCodeId={selectedCodeId}
          onSelect={onSelect}
          codingCounts={codingCounts}
        />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  depth,
  selectedCodeId,
  onSelect,
  codingCounts,
}: {
  node: CodeTreeNode;
  depth: number;
  selectedCodeId: string | null;
  onSelect: (id: string) => void;
  codingCounts: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const { code } = node;
  const hasChildren = node.children.length > 0;
  const count = codingCounts[code.id] ?? 0;
  const isSelected = selectedCodeId === code.id;

  async function handleRename() {
    if (renameValue.trim()) {
      await updateCode(code.id, { name: renameValue.trim() });
    }
    setRenaming(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    await deleteCode(code.id);
  }

  return (
    <li>
      <div
        className={`group flex items-center gap-1.5 py-1 pr-3 cursor-pointer ${
          isSelected ? "bg-stone-100" : "hover:bg-stone-50"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onSelect(code.id)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] text-stone-400"
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Color swatch */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: code.color }}
        />

        {/* Name or rename input */}
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="flex-1 rounded border border-stone-300 px-1 py-0.5 text-sm focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`flex-1 truncate text-sm ${
              isSelected ? "font-medium text-stone-900" : "text-stone-700"
            }`}
            onDoubleClick={() => {
              setRenameValue(code.name);
              setRenaming(true);
            }}
          >
            {code.name}
          </span>
        )}

        {/* Coding count */}
        {count > 0 && (
          <span className="text-[10px] text-stone-400 tabular-nums">
            {count}
          </span>
        )}

        {/* Provenance badge */}
        <span className="text-[10px] text-stone-400">
          {PROVENANCE_LABELS[code.provenance] ?? code.provenance}
        </span>

        {/* Delete button (on hover) */}
        <button
          onClick={handleDelete}
          className="hidden text-[10px] text-stone-400 hover:text-red-500 group-hover:inline"
          title="Delete code"
        >
          ×
        </button>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.code.id}
              node={child}
              depth={depth + 1}
              selectedCodeId={selectedCodeId}
              onSelect={onSelect}
              codingCounts={codingCounts}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
