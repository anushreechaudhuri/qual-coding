"use client";

import { useState, useMemo, useCallback } from "react";
import type { Code } from "@/types";

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
  const [focusIndex, setFocusIndex] = useState(0);

  const toggleCode = useCallback(
    (codeId: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(codeId)) {
          next.delete(codeId);
        } else {
          next.add(codeId);
          const code = codes.find((c) => c.id === codeId);
          if (code?.parentId) next.add(code.parentId);
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

    const recentCodes = recentCodeIds
      .map((id) => matching.find((c) => c.id === id))
      .filter(Boolean) as Code[];
    for (const c of recentCodes) {
      result.push({ code: c, depth: 0 });
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

  // Reset focus when search changes
  useMemo(() => setFocusIndex(0), [search]);

  function handleApply() {
    if (selected.size > 0) {
      onSelect(Array.from(selected));
    }
  }

  function handleQuickApply(codeId: string) {
    const code = codes.find((c) => c.id === codeId);
    const ids = [codeId];
    if (code?.parentId) ids.push(code.parentId);
    onSelect(ids);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, orderedCodes.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
      return;
    }

    // Enter: toggle focused code's checkbox
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const focused = orderedCodes[focusIndex];
      if (focused) {
        toggleCode(focused.code.id);
      }
      return;
    }

    // Shift+Enter: apply selected codes (or quick-apply focused)
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (selected.size > 0) {
        handleApply();
      } else {
        const focused = orderedCodes[focusIndex];
        if (focused) handleQuickApply(focused.code.id);
      }
      return;
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-52 rounded-md border border-stone-200 bg-white shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type to search codes..."
          className="w-full border-b border-stone-100 px-3 py-1.5 text-xs focus:outline-none"
          onKeyDown={handleKeyDown}
        />
        <div className="max-h-48 overflow-y-auto py-0.5">
          {orderedCodes.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">No matching codes</p>
          ) : (
            orderedCodes.map(({ code, depth }, i) => {
              const isSelected = selected.has(code.id);
              const isFocused = i === focusIndex;
              return (
                <div
                  key={code.id}
                  className={`flex items-center gap-1 py-0.5 ${
                    isFocused ? "bg-stone-100" : "hover:bg-stone-50"
                  }`}
                  style={{ paddingLeft: `${depth * 12 + 6}px`, paddingRight: "6px" }}
                  onMouseEnter={() => setFocusIndex(i)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCode(code.id)}
                    className="h-3 w-3 rounded border-stone-300 shrink-0"
                    tabIndex={-1}
                  />
                  <button
                    onClick={() => handleQuickApply(code.id)}
                    className="flex flex-1 items-center gap-1.5 text-left min-w-0"
                    tabIndex={-1}
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

        {/* Apply button: always shown when any codes are checked */}
        {selected.size > 0 && (
          <div className="border-t border-stone-100 px-2 py-1.5">
            <button
              onClick={handleApply}
              className="w-full rounded bg-stone-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-stone-800"
            >
              Apply {selected.size} {selected.size === 1 ? "code" : "codes"}
              <span className="ml-1 text-stone-400">(Shift+Enter)</span>
            </button>
          </div>
        )}

        {/* Hint */}
        <div className="border-t border-stone-100 px-2 py-1 text-[9px] text-stone-400">
          Click to quick-apply &middot; Check to multi-select &middot; ↑↓ navigate &middot; Enter toggle &middot; Shift+Enter apply
        </div>
      </div>
    </>
  );
}
