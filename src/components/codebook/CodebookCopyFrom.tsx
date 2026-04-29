"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { createCode } from "@/lib/db/operations";
import type { Code } from "@/types";

/**
 * Import codes from another project's codebook. Lets you pick a source
 * project, then select individual codes or import all. Preserves
 * hierarchy (parent/child relationships) and marks imported codes
 * with "imported" provenance.
 */
export function CodebookCopyFrom({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [sourceProjectId, setSourceProjectId] = useState<string | null>(null);
  const [selectedCodeIds, setSelectedCodeIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [codeSearch, setCodeSearch] = useState("");

  const projects = useLiveQuery(
    () =>
      db.projects
        .filter((p) => p.deletedAt === null && p.id !== projectId)
        .toArray(),
    [projectId]
  );

  const sourceCodes = useLiveQuery(
    () =>
      sourceProjectId
        ? db.codes
            .where("projectId")
            .equals(sourceProjectId)
            .filter((c) => c.deletedAt === null)
            .toArray()
        : [],
    [sourceProjectId]
  );

  const parentCodes = useMemo(
    () => (sourceCodes ?? []).filter((c) => c.parentId === null),
    [sourceCodes]
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string, Code[]>();
    for (const code of sourceCodes ?? []) {
      if (code.parentId) {
        if (!map.has(code.parentId)) map.set(code.parentId, []);
        map.get(code.parentId)!.push(code);
      }
    }
    return map;
  }, [sourceCodes]);

  function toggleCode(id: string) {
    setSelectedCodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedCodeIds(new Set((sourceCodes ?? []).map((c) => c.id)));
  }

  function selectNone() {
    setSelectedCodeIds(new Set());
  }

  async function handleImport() {
    if (!sourceCodes || selectedCodeIds.size === 0) return;
    setImporting(true);

    try {
      const selected = sourceCodes.filter((c) => selectedCodeIds.has(c.id));

      // Import parents first, then children, to maintain hierarchy
      const oldToNewId = new Map<string, string>();

      // Pass 1: parent codes (parentId === null or parent not selected)
      for (const code of selected) {
        if (!code.parentId || !selectedCodeIds.has(code.parentId)) {
          const created = await createCode({
            projectId,
            name: code.name,
            parentId: null,
            definition: code.definition,
            color: code.color,
            provenance: "imported",
          });
          oldToNewId.set(code.id, created.id);
        }
      }

      // Pass 2: child codes whose parent was also selected
      for (const code of selected) {
        if (code.parentId && selectedCodeIds.has(code.parentId)) {
          const newParentId = oldToNewId.get(code.parentId) ?? null;
          const created = await createCode({
            projectId,
            name: code.name,
            parentId: newParentId,
            definition: code.definition,
            color: code.color,
            provenance: "imported",
          });
          oldToNewId.set(code.id, created.id);
        }
      }

      onClose();
    } catch {
      // errors handled silently for now
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-stone-900">
          Copy codes from another project
        </h2>

        {!sourceProjectId ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-stone-600">Select source project:</p>
            {!projects || projects.length === 0 ? (
              <p className="text-sm text-stone-400">No other projects found.</p>
            ) : (
              <>
                {projects.length > 3 && (
                  <input
                    autoFocus
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm placeholder:text-stone-400 focus:border-stone-300 focus:outline-none"
                  />
                )}
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {projects
                    .filter((p) =>
                      p.name.toLowerCase().includes(projectSearch.toLowerCase())
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSourceProjectId(p.id)}
                        className="flex w-full rounded px-3 py-2 text-left text-sm hover:bg-stone-50"
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              </>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="rounded px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {(sourceCodes ?? []).length > 5 && (
              <input
                autoFocus
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="Search codes..."
                className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm placeholder:text-stone-400 focus:border-stone-300 focus:outline-none"
              />
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-600">
                Select codes to import:
              </p>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={selectAll}
                  className="text-stone-500 hover:text-stone-700"
                >
                  All
                </button>
                <button
                  onClick={selectNone}
                  className="text-stone-500 hover:text-stone-700"
                >
                  None
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded border border-stone-200 divide-y divide-stone-50">
              {parentCodes
                .filter((p) => {
                  if (!codeSearch) return true;
                  const q = codeSearch.toLowerCase();
                  const children = childrenOf.get(p.id) ?? [];
                  return p.name.toLowerCase().includes(q) ||
                    children.some((c) => c.name.toLowerCase().includes(q));
                })
                .map((parent) => (
                <div key={parent.id}>
                  <label className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCodeIds.has(parent.id)}
                      onChange={() => toggleCode(parent.id)}
                      className="rounded border-stone-300"
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: parent.color }}
                    />
                    <span className="text-sm font-medium text-stone-800">
                      {parent.name}
                    </span>
                  </label>
                  {(childrenOf.get(parent.id) ?? []).map((child) => (
                    <label
                      key={child.id}
                      className="flex items-center gap-2 pl-8 pr-3 py-1.5 hover:bg-stone-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCodeIds.has(child.id)}
                        onChange={() => toggleCode(child.id)}
                        className="rounded border-stone-300"
                      />
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: child.color }}
                      />
                      <span className="text-sm text-stone-600">
                        {child.name}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setSourceProjectId(null)}
                className="rounded px-4 py-2 text-sm text-stone-500 hover:bg-stone-50"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCodeIds.size === 0}
                  className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
                >
                  {importing
                    ? "Importing..."
                    : `Import ${selectedCodeIds.size} codes`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
