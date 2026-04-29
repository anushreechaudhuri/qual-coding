"use client";

import { useState, useMemo } from "react";
import type { Code } from "@/types";

/**
 * Search-as-you-type dropdown for selecting a code to apply.
 * Recently used codes appear at the top.
 */
export function CodePicker({
  codes,
  recentCodeIds,
  onSelect,
  onClose,
  position,
}: {
  codes: Code[];
  recentCodeIds: string[];
  onSelect: (codeId: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    const matching = codes.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.definition.toLowerCase().includes(query)
    );

    // Sort: recent codes first, then alphabetical
    const recentSet = new Set(recentCodeIds);
    return matching.sort((a, b) => {
      const aRecent = recentSet.has(a.id);
      const bRecent = recentSet.has(b.id);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [codes, search, recentCodeIds]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown */}
      <div
        className="fixed z-50 w-56 rounded-md border border-stone-200 bg-white shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search codes..."
          className="w-full border-b border-stone-100 px-3 py-2 text-sm focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered.length > 0) {
              onSelect(filtered[0].id);
            }
          }}
        />
        <div className="max-h-48 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">No matching codes</p>
          ) : (
            filtered.map((code) => (
              <button
                key={code.id}
                onClick={() => onSelect(code.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-stone-50"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: code.color }}
                />
                <span className="truncate">{code.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
