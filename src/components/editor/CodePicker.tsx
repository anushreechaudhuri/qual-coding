"use client";

import { useState, useMemo } from "react";
import type { Code } from "@/types";

/**
 * Search-as-you-type dropdown for selecting a code to apply.
 * Shows hierarchical structure (children indented under parents).
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

  const orderedCodes = useMemo(() => {
    const query = search.toLowerCase();
    const matching = codes.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.definition.toLowerCase().includes(query)
    );

    if (search) {
      // When searching, show flat list sorted by relevance
      const recentSet = new Set(recentCodeIds);
      return matching
        .sort((a, b) => {
          const aRecent = recentSet.has(a.id);
          const bRecent = recentSet.has(b.id);
          if (aRecent && !bRecent) return -1;
          if (!aRecent && bRecent) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((c) => ({ code: c, depth: 0 }));
    }

    // No search: show hierarchical tree with recent codes pinned at top
    const recentSet = new Set(recentCodeIds);
    const recentCodes = recentCodeIds
      .map((id) => matching.find((c) => c.id === id))
      .filter(Boolean) as Code[];

    const parents = matching.filter((c) => !c.parentId);
    const childrenMap = new Map<string, Code[]>();
    for (const c of matching) {
      if (c.parentId) {
        if (!childrenMap.has(c.parentId)) childrenMap.set(c.parentId, []);
        childrenMap.get(c.parentId)!.push(c);
      }
    }

    const result: { code: Code; depth: number }[] = [];

    // Recent codes first (flat)
    if (recentCodes.length > 0) {
      for (const c of recentCodes) {
        result.push({ code: c, depth: 0 });
      }
    }

    // Then full tree
    for (const parent of parents) {
      if (recentSet.has(parent.id)) continue;
      result.push({ code: parent, depth: 0 });
      for (const child of childrenMap.get(parent.id) ?? []) {
        if (recentSet.has(child.id)) continue;
        result.push({ code: child, depth: 1 });
      }
    }

    return result;
  }, [codes, search, recentCodeIds]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-52 rounded-md border border-stone-200 bg-white shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search codes..."
          className="w-full border-b border-stone-100 px-3 py-1.5 text-xs focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && orderedCodes.length > 0) {
              onSelect(orderedCodes[0].code.id);
            }
          }}
        />
        <div className="max-h-48 overflow-y-auto py-0.5">
          {orderedCodes.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">No matching codes</p>
          ) : (
            orderedCodes.map(({ code, depth }) => (
              <button
                key={code.id}
                onClick={() => onSelect(code.id)}
                className="flex w-full items-center gap-1.5 py-1 text-left text-xs hover:bg-stone-50"
                style={{ paddingLeft: `${depth * 12 + 10}px`, paddingRight: "10px" }}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
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
