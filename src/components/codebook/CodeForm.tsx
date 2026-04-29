"use client";

import { useState, useEffect } from "react";
import { createCode } from "@/lib/db/operations";
import type { Code } from "@/types";

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#78716c",
];

function randomColor(): string {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

/**
 * Darken or lighten a hex color to create a shade for child codes.
 * offset > 0 lightens, offset < 0 darkens.
 */
function shadeColor(hex: string, offset: number): string {
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + offset));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + offset));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + offset));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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
  const [color, setColor] = useState(randomColor());
  const [hexInput, setHexInput] = useState(color);

  // Auto-assign a shade of the parent's color when parent changes
  useEffect(() => {
    if (parentId) {
      const parent = codes.find((c) => c.id === parentId);
      if (parent) {
        const childCount = codes.filter((c) => c.parentId === parentId).length;
        const shade = shadeColor(parent.color, 30 + childCount * 15);
        setColor(shade);
        setHexInput(shade);
      }
    } else {
      const newColor = randomColor();
      setColor(newColor);
      setHexInput(newColor);
    }
  }, [parentId, codes]);

  function handleHexChange(value: string) {
    setHexInput(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setColor(value);
    }
  }

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
              onChange={(e) => setParentId(e.target.value || null)}
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
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setHexInput(c);
                    }}
                    className={`h-5 w-5 rounded-full border-2 ${
                      color === c ? "border-stone-900" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setHexInput(e.target.value);
                }}
                className="h-6 w-6 cursor-pointer rounded border-0 p-0"
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#000000"
                className="w-20 rounded border border-stone-200 px-2 py-1 text-xs font-mono focus:border-stone-400 focus:outline-none"
              />
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
