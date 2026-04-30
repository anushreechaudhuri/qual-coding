"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  listDriveFolders,
  setSyncFolderId,
  getSyncFolderId,
  type DriveFile,
} from "@/lib/sync/driveClient";

/**
 * Google Drive folder picker for selecting the sync destination.
 * Browses Drive folder hierarchy and lets the user pick where
 * QualCoding data should be stored.
 */
export function DriveFolderPicker() {
  const { data: session } = useSession();
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [currentPath, setCurrentPath] = useState<{ id: string; name: string }[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [savedFolderId, setSavedFolderId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSavedFolderId(getSyncFolderId());
  }, []);

  async function loadFolders(parentId?: string) {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const list = await listDriveFolders(session.accessToken, parentId);
      setFolders(list);
    } catch (err) {
      console.error("Failed to list folders:", err);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    setCurrentPath([]);
    setCurrentFolderId(undefined);
    loadFolders();
  }

  function navigateInto(folder: DriveFile) {
    setCurrentPath([...currentPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    loadFolders(folder.id);
  }

  function navigateUp() {
    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);
    const parentId = newPath.length > 0 ? newPath[newPath.length - 1].id : undefined;
    setCurrentFolderId(parentId);
    loadFolders(parentId);
  }

  function selectCurrentFolder() {
    const folderId = currentFolderId ?? null;
    setSyncFolderId(folderId);
    setSavedFolderId(folderId);
    setOpen(false);
  }

  function resetToDefault() {
    setSyncFolderId(null);
    setSavedFolderId(null);
  }

  if (!session?.accessToken) {
    return (
      <p className="text-xs text-stone-400">Sign in with Google to configure Drive sync folder.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-600">
          Sync folder: {savedFolderId ? "Custom folder" : "QualCoding (Drive root)"}
        </span>
        <button
          onClick={handleOpen}
          className="rounded border border-stone-200 px-2 py-1 text-[10px] text-stone-500 hover:bg-stone-50"
        >
          Change
        </button>
        {savedFolderId && (
          <button
            onClick={resetToDefault}
            className="text-[10px] text-stone-400 hover:text-stone-600"
          >
            Reset to default
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-md border border-stone-200 bg-white p-3 space-y-2">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <button
              onClick={() => {
                setCurrentPath([]);
                setCurrentFolderId(undefined);
                loadFolders();
              }}
              className="hover:text-stone-700"
            >
              My Drive
            </button>
            {currentPath.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <span>/</span>
                <button
                  onClick={() => {
                    const idx = currentPath.indexOf(p);
                    const newPath = currentPath.slice(0, idx + 1);
                    setCurrentPath(newPath);
                    setCurrentFolderId(p.id);
                    loadFolders(p.id);
                  }}
                  className="hover:text-stone-700"
                >
                  {p.name}
                </button>
              </span>
            ))}
          </div>

          {/* Folder list */}
          <div className="max-h-40 overflow-y-auto border border-stone-100 rounded">
            {loading ? (
              <p className="px-3 py-2 text-xs text-stone-400">Loading...</p>
            ) : folders.length === 0 ? (
              <p className="px-3 py-2 text-xs text-stone-400">No subfolders</p>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => navigateInto(folder)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-stone-50"
                >
                  <span className="text-stone-400">📁</span>
                  {folder.name}
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            {currentPath.length > 0 && (
              <button
                onClick={navigateUp}
                className="text-[10px] text-stone-500 hover:text-stone-700"
              >
                ← Back
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-[10px] text-stone-400 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={selectCurrentFolder}
                className="rounded bg-stone-900 px-2 py-1 text-[10px] text-white hover:bg-stone-800"
              >
                Sync here{currentPath.length > 0 ? ` (${currentPath[currentPath.length - 1].name})` : " (Drive root)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
