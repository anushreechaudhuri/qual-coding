"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { updateProject } from "@/lib/db/operations";

/**
 * Modal to sync/unsync a project's codebook with another project.
 * Syncing means both projects share the same codebookGroupId, so
 * any code changes appear in both.
 */
export function CodebookSync({
  projectId,
  codebookGroupId,
  onClose,
}: {
  projectId: string;
  codebookGroupId: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const allProjects = useLiveQuery(
    () => db.projects.filter((p) => p.deletedAt === null).toArray(),
    []
  );

  const linkedProjects = (allProjects ?? []).filter(
    (p) => p.codebookGroupId === codebookGroupId && p.id !== projectId
  );

  const unlinkedProjects = (allProjects ?? []).filter(
    (p) => p.codebookGroupId !== codebookGroupId && p.id !== projectId
  );

  async function linkProject(targetId: string) {
    await updateProject(targetId, { codebookGroupId } as never);
    // Also move the target project's existing codes into this group
    const targetCodes = await db.codes
      .where("projectId")
      .equals(targetId)
      .filter((c) => c.deletedAt === null)
      .toArray();
    for (const code of targetCodes) {
      await db.codes.update(code.id, {
        projectId: codebookGroupId,
        updatedAt: new Date(),
        _dirty: true,
      });
    }
  }

  async function unlinkProject(targetId: string) {
    // Give the unlinked project its own copy of the current codebook
    const sharedCodes = await db.codes
      .where("projectId")
      .equals(codebookGroupId)
      .filter((c) => c.deletedAt === null)
      .toArray();

    // Create copies of all codes for the unlinked project
    const oldToNewId = new Map<string, string>();
    for (const code of sharedCodes.filter((c) => !c.parentId)) {
      const newId = crypto.randomUUID();
      oldToNewId.set(code.id, newId);
      await db.codes.add({
        ...code,
        id: newId,
        projectId: targetId,
        _dirty: true,
        _lastSyncedSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    for (const code of sharedCodes.filter((c) => c.parentId)) {
      const newId = crypto.randomUUID();
      oldToNewId.set(code.id, newId);
      await db.codes.add({
        ...code,
        id: newId,
        projectId: targetId,
        parentId: oldToNewId.get(code.parentId!) ?? null,
        _dirty: true,
        _lastSyncedSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Update the project's codebookGroupId to its own ID
    await updateProject(targetId, { codebookGroupId: targetId } as never);
  }

  const filteredUnlinked = unlinkedProjects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-stone-900">
          Sync codebook
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Synced projects share the same codebook. Edits in one appear in all.
        </p>

        {/* Currently linked projects */}
        {linkedProjects.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-stone-600 mb-1">
              Currently synced with:
            </p>
            <div className="space-y-1">
              {linkedProjects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded bg-blue-50 px-3 py-1.5"
                >
                  <span className="text-sm text-blue-800">{p.name}</span>
                  <button
                    onClick={() => unlinkProject(p.id)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Unsync
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link a new project */}
        <div className="mt-4">
          <p className="text-xs font-medium text-stone-600 mb-1">
            Sync with another project:
          </p>
          {unlinkedProjects.length > 3 && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="mb-2 w-full rounded border border-stone-200 px-2 py-1.5 text-sm placeholder:text-stone-400 focus:border-stone-300 focus:outline-none"
            />
          )}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredUnlinked.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">No other projects to sync with.</p>
            ) : (
              filteredUnlinked.map((p) => (
                <button
                  key={p.id}
                  onClick={() => linkProject(p.id)}
                  className="flex w-full rounded px-3 py-1.5 text-left text-sm hover:bg-stone-50"
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
