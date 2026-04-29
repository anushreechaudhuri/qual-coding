"use client";

import { useState, useMemo, useCallback } from "react";
import type { Code } from "@/types";

/**
 * Multi-select code picker with checkboxes. Shows hierarchical structure.
 * Selecting a child auto-selects its parent. Apply button commits all
 * selected codes at once.
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
  onSelect: (codeIds: string[]) => void;
  onClose: () => void;
  position: { x: number; y: number };
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleCode = useCallback(
    (codeId: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(codeId)) {
          next.delete(codeId);
        } else {
          next.add(codeId);
          // Auto-select parent when child is selected
          const code = codes.find((c) => c.id === codeId);
          if (code?.parentId) {
            next.add(code.parentId);
          }
        }
        return next;
      });
    },
    [codes]
  );

  const orderedCodes = useMemo(() => {
    const query = search.toLowerCase();
    const matching = codes.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.definition.toLowerCase().includes(query)
    );

    if (search) {
      return matching
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ code: c, depth: 0 }));
    }

    const recentSet = new Set(recentCodeIds);
    const parents = matching.filter((c) => !c.parentId);
    const childrenMap = new Map<string, Code[]>();
    for (const c of matching) {
      if (c.parentId) {
        if (!childrenMap.has(c.parentId)) childrenMap.set(c.parentId, []);
        childrenMap.get(c.parentId)!.push(c);
      }
    }

    const result: { code: Code; depth: number }[] = [];

    // Recent codes first
    const recentCodes = recentCodeIds
      .map((id) => matching.find((c) => c.id === id))
      .filter(Boolean) as Code[];
    if (recentCodes.length > 0 && !search) {
      for (const c of recentCodes) {
        result.push({ code: c, depth: 0 });
      }
      if (parents.length > recentCodes.length) {
        result.push({ code: { id: "__sep__", name: "—", parentId: null } as Code, depth: -1 });
      }
    }

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

  function handleApply() {
    if (selected.size > 0) {
      onSelect(Array.from(selected));
    }
  }

  // Quick apply: single click without checkbox for speed
  function handleQuickApply(codeId: string) {
    const code = codes.find((c) => c.id === codeId);
    const ids = [codeId];
    if (code?.parentId) ids.push(code.parentId);
    onSelect(ids);
  }

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
            if (e.key === "Enter") {
              if (selected.size > 0) {
                handleApply();
              } else if (orderedCodes.length > 0 && orderedCodes[0].code.id !== "__sep__") {
                handleQuickApply(orderedCodes[0].code.id);
              }
            }
          }}
        />
        <div className="max-h-48 overflow-y-auto py-0.5">
          {orderedCodes.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">No matching codes</p>
          ) : (
            orderedCodes.map(({ code, depth }) => {
              if (code.id === "__sep__") {
                return <div key="sep" className="border-t border-stone-100 my-0.5" />;
              }
              const isSelected = selected.has(code.id);
              return (
                <div
                  key={code.id}
                  className="flex items-center gap-1 py-0.5 hover:bg-stone-50"
                  style={{ paddingLeft: `${depth * 12 + 6}px`, paddingRight: "6px" }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCode(code.id)}
                    className="h-3 w-3 rounded border-stone-300 shrink-0"
                  />
                  <button
                    onClick={() => handleQuickApply(code.id)}
                    className="flex flex-1 items-center gap-1.5 text-left min-w-0"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: code.color }}
                    />
                    <span className="text-xs truncate text-stone-700">{code.name}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Apply button for multi-select */}
        {selected.size > 1 && (
          <div className="border-t border-stone-100 px-2 py-1.5">
            <button
              onClick={handleApply}
              className="w-full rounded bg-stone-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-stone-800"
            >
              Apply {selected.size} codes
            </button>
          </div>
        )}
      </div>
    </>
  );
}
