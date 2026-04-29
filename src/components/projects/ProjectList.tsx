"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useUiStore } from "@/lib/stores/uiStore";
import { deleteProject, updateProject } from "@/lib/db/operations";
import { useState } from "react";

/**
 * Left-panel list of all projects. Clicking a project sets it as current.
 * Includes create, rename, and delete functionality.
 */
export function ProjectList({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  const currentProjectId = useUiStore((s) => s.currentProjectId);
  const setCurrentProject = useUiStore((s) => s.setCurrentProject);

  const projects = useLiveQuery(
    () =>
      db.projects
        .filter((p) => p.deletedAt === null)
        .sortBy("createdAt"),
    []
  );

  const [collapsed, setCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  async function finishRename(id: string) {
    if (renameValue.trim()) {
      await updateProject(id, { name: renameValue.trim() });
    }
    setRenamingId(null);
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    setConfirmDeleteId(null);
    if (currentProjectId === id) {
      setCurrentProject(null);
    }
  }

  if (!projects) return null;

  if (projects.length === 0) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-stone-500">No projects yet.</p>
        <button
          onClick={onCreateClick}
          className="w-full rounded-md border border-dashed border-stone-300 py-2 text-sm text-stone-600 hover:border-stone-400 hover:text-stone-800"
        >
          Create your first project
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-stone-400 hover:text-stone-600"
        >
          <span className="text-[9px]">{collapsed ? "▶" : "▼"}</span>
          Projects
        </button>
        <button
          onClick={onCreateClick}
          className="text-xs text-stone-400 hover:text-stone-600"
          title="New project"
        >
          +
        </button>
      </div>

      {!collapsed && (
        <ul className="space-y-px">
        {projects.map((project) => (
          <li key={project.id}>
            {renamingId === project.id ? (
              <div className="px-3 py-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => finishRename(project.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRename(project.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="w-full rounded border border-stone-300 px-2 py-1 text-sm focus:border-stone-400 focus:outline-none"
                />
              </div>
            ) : confirmDeleteId === project.id ? (
              <div className="px-3 py-1.5 bg-red-50 text-xs space-y-1">
                <p className="text-red-700">
                  Delete &ldquo;{project.name}&rdquo; and all its data?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-red-600 font-medium hover:text-red-800"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-stone-500 hover:text-stone-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCurrentProject(project.id)}
                onDoubleClick={() => startRename(project.id, project.name)}
                className={`group flex w-full items-center justify-between px-4 py-1.5 text-left text-sm ${
                  currentProjectId === project.id
                    ? "bg-stone-100 font-medium text-stone-900"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span className="truncate">{project.name}</span>
                <span className="hidden shrink-0 gap-1 group-hover:flex">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(project.id, project.name);
                    }}
                    className="cursor-pointer text-[10px] text-stone-400 hover:text-stone-600"
                    title="Rename"
                  >
                    edit
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(project.id);
                    }}
                    className="cursor-pointer text-[10px] text-stone-400 hover:text-red-500"
                    title="Delete"
                  >
                    del
                  </span>
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
