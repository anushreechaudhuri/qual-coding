"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useCodebook } from "@/hooks/useCodebook";
import { CodeTree } from "./CodeTree";
import { CodeDetail } from "./CodeDetail";
import { CodeForm } from "./CodeForm";
import { CodebookImport } from "./CodebookImport";
import { CodebookCopyFrom } from "./CodebookCopyFrom";

/**
 * Right-panel codebook section. Shows the code tree with option to
 * expand a selected code's detail view.
 */
export function CodebookPanel({ projectId }: { projectId: string }) {
  const codes = useCodebook(projectId);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCopyFrom, setShowCopyFrom] = useState(false);

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
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100">
        <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
          Codebook
        </span>
        <div className="flex gap-2 text-xs text-stone-400">
          <button
            onClick={() => setShowCreate(true)}
            className="hover:text-stone-600"
          >
            + Add
          </button>
          <button
            onClick={() => setShowCopyFrom(true)}
            className="hover:text-stone-600"
          >
            Copy
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="hover:text-stone-600"
          >
            Upload
          </button>
        </div>
      </div>

      {/* Code tree */}
      <div className="flex-1 overflow-y-auto">
        <CodeTree
          codes={codes}
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
          projectId={projectId}
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
          projectId={projectId}
          onClose={() => setShowCopyFrom(false)}
        />
      )}
    </div>
  );
}
