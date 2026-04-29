"use client";

import { useState } from "react";
import type { AudioSegment, Document } from "@/types";
import { updateDocument } from "@/lib/db/operations";

/**
 * Renders audio transcription segments with speaker labels, timestamps,
 * original text, and translation. Speaker names are clickable to rename
 * per-segment or bulk (all segments with that name).
 */
export function SegmentList({
  document: doc,
  segments,
  activeSegmentIndex,
  onSeek,
}: {
  document: Document;
  segments: AudioSegment[];
  activeSegmentIndex: number | null;
  onSeek: (timestamp: string) => void;
}) {
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameMode, setRenameMode] = useState<"single" | "all">("single");

  async function handleSpeakerRename(segmentIndex: number, oldName: string) {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setEditingSegmentIndex(null);
      return;
    }

    let updatedSegments: AudioSegment[];

    if (renameMode === "all") {
      updatedSegments = doc.segments.map((seg) =>
        seg.speaker === oldName ? { ...seg, speaker: newName } : seg
      );
    } else {
      updatedSegments = doc.segments.map((seg) =>
        seg.index === segmentIndex ? { ...seg, speaker: newName } : seg
      );
    }

    const content = updatedSegments
      .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.content}`)
      .join("\n\n");

    const translationContent =
      updatedSegments
        .filter((seg) => seg.translation && seg.translation !== seg.content)
        .map((seg) => `${seg.speaker} · ${seg.timestamp}\n${seg.translation}`)
        .join("\n\n") || null;

    await updateDocument(doc.id, {
      segments: updatedSegments,
      content,
      translationContent,
    });

    setEditingSegmentIndex(null);
  }

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-stone-400">No segments</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100" data-content-container>
      {segments.map((segment) => (
        <div
          key={segment.index}
          onClick={() => onSeek(segment.timestamp)}
          className={`w-full px-6 py-3 text-left transition-colors hover:bg-stone-50 cursor-pointer ${
            activeSegmentIndex === segment.index ? "bg-stone-50" : ""
          }`}
        >
          <div className="flex items-baseline gap-2 mb-1">
            {editingSegmentIndex === segment.index ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSpeakerRename(segment.index, segment.speaker);
                    if (e.key === "Escape") setEditingSegmentIndex(null);
                  }}
                  className="rounded border border-stone-300 px-1.5 py-0.5 text-xs w-28 focus:outline-none"
                />
                <select
                  value={renameMode}
                  onChange={(e) => setRenameMode(e.target.value as "single" | "all")}
                  className="rounded border border-stone-200 text-[10px] py-0.5 focus:outline-none"
                >
                  <option value="single">This segment</option>
                  <option value="all">All &ldquo;{segment.speaker}&rdquo;</option>
                </select>
                <button
                  onClick={() => handleSpeakerRename(segment.index, segment.speaker)}
                  className="rounded bg-stone-900 px-2 py-0.5 text-[10px] text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingSegmentIndex(null)}
                  className="text-[10px] text-stone-400"
                >
                  ×
                </button>
              </div>
            ) : (
              <span
                className="text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded px-1 -mx-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(segment.speaker);
                  setEditingSegmentIndex(segment.index);
                  setRenameMode("single");
                }}
                title="Click to rename speaker"
              >
                {segment.speaker}
              </span>
            )}
            <span className="text-[11px] text-stone-400">
              {segment.timestamp}
            </span>
          </div>
          <p className="font-serif text-stone-900 whitespace-pre-wrap leading-relaxed">
            {segment.content}
          </p>
          {segment.translation && segment.translation !== segment.content && (
            <p className="mt-1 font-serif text-sm italic text-stone-500 whitespace-pre-wrap">
              {segment.translation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
