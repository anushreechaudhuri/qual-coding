"use client";

import { useState } from "react";
import { createCode } from "@/lib/db/operations";
import type { Code } from "@/types";

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#78716c",
];

/**
 * Form for creating a new code. Supports optional parent selection
 * for building hierarchical codebooks.
 */
export function CodeForm({
  projectId,
  codes,
  onClose,
}: {
  projectId: string;
  codes: Code[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [definition, setDefinition] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    await createCode({
      projectId,
      name: name.trim(),
      parentId,
      definition: definition.trim(),
      color,
      provenance: "user",
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-stone-900">New code</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Compensation"
              className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              Parent{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <select
              value={parentId ?? ""}
              onChange={(e) =>
                setParentId(e.target.value || null)
              }
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
            >
              <option value="">None (top level)</option>
              {codes
                .filter((c) => c.parentId === null)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              Definition{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Color
            </label>
            <div className="flex gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${
                    color === c ? "border-stone-900" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
