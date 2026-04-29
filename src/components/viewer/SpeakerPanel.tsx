"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  listSpeakers,
  createSpeaker,
  updateSpeaker,
  updateDocument,
} from "@/lib/db/operations";
import type { Document, Speaker, AudioSegment, SpeakerScope } from "@/types";

/**
 * Panel for managing speakers associated with the current project.
 * Supports inline rename, scope toggling, adding new speakers,
 * and bulk-renaming a speaker across all document segments.
 */
export function SpeakerPanel({
  document: doc,
  onClose,
}: {
  document: Document;
  onClose: () => void;
}) {
  const projectId = doc.projectId;

  const speakers = useLiveQuery(
    () => listSpeakers(projectId),
    [projectId]
  );

  const segmentSpeakerNames = useMemo(
    () => [...new Set(doc.segments.map((s) => s.speaker))],
    [doc.segments]
  );

  const [addingName, setAddingName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [bulkFrom, setBulkFrom] = useState<string | null>(null);
  const [bulkTo, setBulkTo] = useState("");

  async function handleAdd() {
    const name = addingName.trim();
    if (!name) return;
    await createSpeaker(name, "project", [projectId]);
    setAddingName("");
  }

  async function handleInlineRename(speaker: Speaker) {
    const newName = editValue.trim();
    if (!newName || newName === speaker.name) {
      setEditingId(null);
      return;
    }
    await updateSpeaker(speaker.id, { name: newName });
    setEditingId(null);
  }

  async function handleToggleScope(speaker: Speaker) {
    const newScope: SpeakerScope =
      speaker.scope === "global" ? "project" : "global";
    const newProjectIds =
      newScope === "global"
        ? speaker.projectIds
        : speaker.projectIds.includes(projectId)
          ? speaker.projectIds
          : [...speaker.projectIds, projectId];
    await updateSpeaker(speaker.id, {
      scope: newScope,
      projectIds: newProjectIds,
    });
  }

  async function handleBulkRename() {
    if (!bulkFrom || !bulkTo.trim()) return;
    const newName = bulkTo.trim();
    if (newName === bulkFrom) {
      setBulkFrom(null);
      setBulkTo("");
      return;
    }

    const updatedSegments: AudioSegment[] = doc.segments.map((seg) =>
      seg.speaker === bulkFrom ? { ...seg, speaker: newName } : seg
    );

    const content = updatedSegments
      .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.content}`)
      .join("\n\n");

    const translationContent =
      updatedSegments
        .filter((seg) => seg.translation && seg.translation !== seg.content)
        .map(
          (seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.translation}`
        )
        .join("\n\n") || null;

    await updateDocument(doc.id, {
      segments: updatedSegments,
      content,
      translationContent,
    });

    setBulkFrom(null);
    setBulkTo("");
  }

  if (!speakers) return null;

  return (
    <div className="border-t border-stone-100 px-6 py-4 bg-stone-50/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Speaker Management
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          Close
        </button>
      </div>

      {/* Speaker list */}
      {speakers.length === 0 ? (
        <p className="text-xs text-stone-400 mb-3">
          No speakers registered for this project yet.
        </p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {speakers.map((speaker) => (
            <li
              key={speaker.id}
              className="flex items-center gap-2 rounded bg-white border border-stone-100 px-2.5 py-1.5"
            >
              {/* Inline editable name */}
              {editingId === speaker.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleInlineRename(speaker)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInlineRename(speaker);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 rounded border border-stone-300 px-1.5 py-0.5 text-xs focus:outline-none"
                />
              ) : (
                <span
                  className="flex-1 text-sm text-stone-700 cursor-pointer hover:text-stone-900"
                  onClick={() => {
                    setEditingId(speaker.id);
                    setEditValue(speaker.name);
                  }}
                  title="Click to rename"
                >
                  {speaker.name}
                </span>
              )}

              {/* Scope badge + toggle */}
              <button
                onClick={() => handleToggleScope(speaker)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  speaker.scope === "global"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-stone-100 text-stone-500"
                }`}
                title={`Click to switch to ${speaker.scope === "global" ? "project" : "global"} scope`}
              >
                {speaker.scope}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add speaker */}
      <div className="flex items-center gap-2 mb-4">
        <input
          value={addingName}
          onChange={(e) => setAddingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="New speaker name"
          className="flex-1 rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:border-stone-400"
        />
        <button
          onClick={handleAdd}
          disabled={!addingName.trim()}
          className="rounded bg-stone-800 px-2.5 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-40"
        >
          Add speaker
        </button>
      </div>

      {/* Bulk rename */}
      {segmentSpeakerNames.length > 0 && (
        <div className="border-t border-stone-100 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">
            Bulk rename in segments
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={bulkFrom ?? ""}
              onChange={(e) => {
                const val = e.target.value || null;
                setBulkFrom(val);
                if (val) setBulkTo(val);
              }}
              className="rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none"
            >
              <option value="">Select speaker...</option>
              {segmentSpeakerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {bulkFrom && (
              <>
                <span className="text-xs text-stone-400">&rarr;</span>
                <input
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleBulkRename();
                  }}
                  placeholder="New name"
                  className="rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none flex-1 min-w-[120px]"
                />
                <button
                  onClick={handleBulkRename}
                  disabled={!bulkTo.trim() || bulkTo.trim() === bulkFrom}
                  className="rounded bg-stone-800 px-2.5 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-40"
                >
                  Rename all
                </button>
                <button
                  onClick={() => {
                    setBulkFrom(null);
                    setBulkTo("");
                  }}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
