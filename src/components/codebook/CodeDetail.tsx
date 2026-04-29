"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { updateCode, deleteCode } from "@/lib/db/operations";
import { mergeCodes } from "@/lib/codebook/codebookOperations";
import { MemoEditor } from "@/components/memos/MemoEditor";
import { MemoList } from "@/components/memos/MemoList";
import type { Code } from "@/types";

/**
 * Detail panel for a selected code: definition, stats, recent quotations,
 * and actions (edit, merge, delete).
 */
export function CodeDetail({
  code,
  allCodes,
}: {
  code: Code;
  allCodes: Code[];
}) {
  const [editing, setEditing] = useState(false);
  const [definition, setDefinition] = useState(code.definition);
  const [showMerge, setShowMerge] = useState(false);
  const [showMemo, setShowMemo] = useState(false);

  // Get coding count and recent quotations for this code
  const codings = useLiveQuery(
    () =>
      db.codings
        .where("codeId")
        .equals(code.id)
        .filter((c) => c.deletedAt === null)
        .limit(5)
        .toArray(),
    [code.id]
  );

  const codingCount = useLiveQuery(
    () =>
      db.codings
        .where("codeId")
        .equals(code.id)
        .filter((c) => c.deletedAt === null)
        .count(),
    [code.id]
  );

  const documentCount = useLiveQuery(async () => {
    const docIds = new Set(
      (
        await db.codings
          .where("codeId")
          .equals(code.id)
          .filter((c) => c.deletedAt === null)
          .toArray()
      ).map((c) => c.documentId)
    );
    return docIds.size;
  }, [code.id]);

  const parentCode = allCodes.find((c) => c.id === code.parentId);

  async function saveDefinition() {
    await updateCode(code.id, { definition });
    setEditing(false);
  }

  async function handleDelete() {
    await deleteCode(code.id);
  }

  async function handleMerge(targetId: string) {
    await mergeCodes(code.id, targetId);
    setShowMerge(false);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Breadcrumb */}
      {parentCode && (
        <div className="text-xs text-stone-400">
          {parentCode.name} &rsaquo;
        </div>
      )}

      {/* Code name with color */}
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-sm"
          style={{ backgroundColor: code.color }}
        />
        <h3 className="text-base font-semibold text-stone-900">{code.name}</h3>
      </div>

      {/* Definition */}
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-stone-400 mb-1">
          Definition
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={saveDefinition}
                className="rounded px-3 py-1 text-xs font-medium bg-stone-900 text-white hover:bg-stone-800"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDefinition(code.definition);
                  setEditing(false);
                }}
                className="rounded px-3 py-1 text-xs text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            className="text-sm text-stone-700 leading-relaxed cursor-pointer hover:bg-stone-50 rounded p-1 -m-1"
            onClick={() => setEditing(true)}
          >
            {code.definition || (
              <span className="italic text-stone-400">
                Click to add a definition
              </span>
            )}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-6 border-t border-b border-stone-100 py-3">
        <Stat label="Coded segments" value={codingCount ?? 0} />
        <Stat label="Documents" value={documentCount ?? 0} />
      </div>

      {/* Recent quotations */}
      {codings && codings.length > 0 && (
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-stone-400 mb-2">
            Recent quotations
          </div>
          <div className="space-y-2">
            {codings.map((coding) => (
              <div
                key={coding.id}
                className="rounded border-l-2 border-stone-200 pl-3 py-1"
              >
                <p className="text-sm text-stone-700 line-clamp-2 font-serif">
                  &ldquo;{coding.quotedText}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memos */}
      {showMemo && (
        <div className="space-y-2">
          <MemoList targetType="code" targetId={code.id} />
          <MemoEditor
            projectId={code.projectId}
            targetType="code"
            targetId={code.id}
            onClose={() => setShowMemo(false)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-stone-100 text-xs">
        <button
          onClick={() => setEditing(true)}
          className="text-stone-500 hover:text-stone-700"
        >
          Edit
        </button>
        <button
          onClick={() => setShowMemo(!showMemo)}
          className="text-stone-500 hover:text-stone-700"
        >
          Memo
        </button>
        <button
          onClick={() => setShowMerge(!showMerge)}
          className="text-stone-500 hover:text-stone-700"
        >
          Merge
        </button>
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700"
        >
          Delete
        </button>
        <span className="ml-auto text-stone-400">
          {code.provenance}
        </span>
      </div>

      {/* Merge target selector */}
      {showMerge && (
        <div className="rounded-md border border-stone-200 p-3 space-y-2">
          <p className="text-xs text-stone-600">
            Merge &ldquo;{code.name}&rdquo; into:
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {allCodes
              .filter((c) => c.id !== code.id)
              .map((target) => (
                <button
                  key={target.id}
                  onClick={() => handleMerge(target.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-stone-50"
                >
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: target.color }}
                  />
                  {target.name}
                </button>
              ))}
          </div>
          <button
            onClick={() => setShowMerge(false)}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold text-stone-900 tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}
