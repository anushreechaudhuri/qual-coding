"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useCodebook, useCodebookGroupId } from "@/hooks/useCodebook";
import { CodeTree } from "./CodeTree";
import { CodeDetail } from "./CodeDetail";
import { CodeForm } from "./CodeForm";
import { CodebookImport } from "./CodebookImport";
import { CodebookCopyFrom } from "./CodebookCopyFrom";
import { CodebookSync } from "./CodebookSync";

/**
 * Right-panel codebook section. Shows the code tree with option to
 * expand a selected code's detail view.
 */
export function CodebookPanel({ projectId }: { projectId: string }) {
  const codebookGroupId = useCodebookGroupId(projectId) ?? projectId;
  const codes = useCodebook(projectId);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCopyFrom, setShowCopyFrom] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isSynced = codebookGroupId !== projectId;

  const selectedCode = codes.find((c) => c.id === selectedCodeId) ?? null;

  // Get coding counts per code for the tree display
  const codingCounts = useLiveQuery(async () => {
    const counts: Record<string, number> = {};
    const allCodings = await db.codings
      .where("projectId")
      .equals(projectId)
      .filter((c) => c.deletedAt === null)
      .toArray();
    for (const coding of allCodings) {
      counts[coding.codeId] = (counts[coding.codeId] ?? 0) + 1;
    }
    return counts;
  }, [projectId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-100">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
            Codebook
          </span>
          {isSynced && (
            <span className="rounded bg-blue-50 px-1 py-px text-[8px] font-medium text-blue-600">
              synced
            </span>
          )}
        </div>
        <div className="flex gap-1 text-[10px] text-stone-400">
          <button onClick={() => setShowCreate(true)} className="hover:text-stone-600" title="Add code">+</button>
          <span className="text-stone-200">|</span>
          <button onClick={() => setShowSync(true)} className="hover:text-stone-600">Sync</button>
          <button onClick={() => setShowCopyFrom(true)} className="hover:text-stone-600">Copy</button>
          <button onClick={() => setShowImport(true)} className="hover:text-stone-600">CSV</button>
        </div>
      </div>

      {/* Search */}
      {codes.length > 5 && (
        <div className="px-3 py-1.5 border-b border-stone-100">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search codes..."
            className="w-full rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-700 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none"
          />
        </div>
      )}

      {/* Code tree */}
      <div className="flex-1 overflow-y-auto">
        <CodeTree
          codes={searchQuery
            ? codes.filter((c) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.definition.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : codes
          }
          selectedCodeId={selectedCodeId}
          onSelect={setSelectedCodeId}
          codingCounts={codingCounts ?? {}}
        />
      </div>

      {/* Selected code detail (bottom section) */}
      {selectedCode && (
        <div className="border-t border-stone-200 max-h-[40%] overflow-y-auto">
          <CodeDetail code={selectedCode} allCodes={codes} />
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CodeForm
          projectId={codebookGroupId}
          codes={codes}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showImport && (
        <CodebookImport
          projectId={projectId}
          onClose={() => setShowImport(false)}
        />
      )}
      {showCopyFrom && (
        <CodebookCopyFrom
          projectId={codebookGroupId}
          onClose={() => setShowCopyFrom(false)}
        />
      )}
      {showSync && (
        <CodebookSync
          projectId={projectId}
          codebookGroupId={codebookGroupId}
          onClose={() => setShowSync(false)}
        />
      )}
    </div>
  );
}
