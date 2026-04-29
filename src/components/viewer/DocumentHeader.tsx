"use client";

import { useState, useMemo } from "react";
import { updateDocument } from "@/lib/db/operations";
import { MemoEditor } from "@/components/memos/MemoEditor";
import { MemoList } from "@/components/memos/MemoList";
import { SpeakerPanel } from "./SpeakerPanel";
import type { Document, AudioSegment } from "@/types";

/**
 * Header bar showing document metadata: title, date, language badge,
 * purpose badge, and audio-specific info (speaker count, duration).
 * For audio documents, shows a speaker list with inline rename.
 */
export function DocumentHeader({ document: doc }: { document: Document }) {
  const isAudio = doc.fileType.startsWith("audio/");
  const [showMemo, setShowMemo] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const [showSpeakerPanel, setShowSpeakerPanel] = useState(false);
  const [autoRenaming, setAutoRenaming] = useState(false);
  const speakers = useMemo(
    () => [...new Set(doc.segments.map((s) => s.speaker))],
    [doc.segments]
  );

  async function handleRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== doc.title) {
      await updateDocument(doc.id, { title: trimmed });
    }
    setRenaming(false);
  }

  async function handleAutoRename() {
    if (!doc.content || autoRenaming) return;
    setAutoRenaming(true);
    try {
      const res = await fetch("/api/gemini/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-Key": localStorage.getItem("qual-coding:api-key:gemini") ?? "",
        },
        body: JSON.stringify({
          content: doc.content.slice(0, 2000),
          currentTitle: doc.title,
          purpose: doc.purpose,
          language: doc.language,
        }),
      });
      if (res.ok) {
        const { title } = await res.json();
        if (title) await updateDocument(doc.id, { title });
      }
    } finally {
      setAutoRenaming(false);
    }
  }

  return (
    <div className="border-b border-stone-100 px-6 py-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="w-full rounded border border-stone-300 px-2 py-1 text-lg font-semibold font-serif focus:outline-none"
            />
          ) : (
            <h2
              className="text-lg font-semibold text-stone-900 font-serif cursor-pointer hover:bg-stone-50 rounded px-1 -mx-1"
              onClick={() => {
                setRenameValue(doc.title);
                setRenaming(true);
              }}
              title="Click to rename"
            >
              {doc.title}
            </h2>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            {doc.dateCollected && <span>{doc.dateCollected}</span>}
            <span>&middot;</span>
            <span>{doc.language}</span>
            {doc.metadata.speakerCount && (
              <>
                <span>&middot;</span>
                <span>{doc.metadata.speakerCount} speakers</span>
              </>
            )}
            {doc.metadata.durationSeconds && (
              <>
                <span>&middot;</span>
                <span>{formatDuration(doc.metadata.durationSeconds)}</span>
              </>
            )}
            <PurposeBadge purpose={doc.purpose} />
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={handleAutoRename}
            disabled={autoRenaming || !doc.content}
            className="rounded px-2 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            title="AI rename based on content"
          >
            {autoRenaming ? "..." : "AI rename"}
          </button>
          <button
            onClick={() => setShowMemo(!showMemo)}
            className="rounded px-2 py-1 text-xs text-stone-400 hover:text-stone-600 hover:bg-stone-50"
          >
          Memo
        </button>
        </div>
      </div>

      {isAudio && speakers.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <SpeakerList document={doc} speakers={speakers} />
          <button
            onClick={() => setShowSpeakerPanel(!showSpeakerPanel)}
            className="ml-1 text-[10px] text-stone-400 hover:text-stone-600 underline underline-offset-2"
          >
            {showSpeakerPanel ? "Hide" : "Manage speakers"}
          </button>
        </div>
      )}

      {isAudio && showSpeakerPanel && (
        <SpeakerPanel
          document={doc}
          onClose={() => setShowSpeakerPanel(false)}
        />
      )}

      {showMemo && (
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
          <MemoList targetType="document" targetId={doc.id} />
          <MemoEditor
            projectId={doc.projectId}
            targetType="document"
            targetId={doc.id}
            onClose={() => setShowMemo(false)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Inline speaker rename: click a speaker label to rename it across
 * all segments in the document.
 */
function SpeakerList({
  document: doc,
  speakers,
}: {
  document: Document;
  speakers: string[];
}) {
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleRename(oldName: string) {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenamingIndex(null);
      return;
    }

    // Replace speaker name in all segments
    const updatedSegments: AudioSegment[] = doc.segments.map((seg) =>
      seg.speaker === oldName ? { ...seg, speaker: newName } : seg
    );

    // Rebuild content and translation with new speaker names
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

    setRenamingIndex(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-stone-400 mr-1">
        Speakers:
      </span>
      {speakers.map((speaker, i) =>
        renamingIndex === i ? (
          <input
            key={i}
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleRename(speaker)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename(speaker);
              if (e.key === "Escape") setRenamingIndex(null);
            }}
            className="rounded border border-stone-300 px-1.5 py-0.5 text-xs focus:outline-none w-28"
          />
        ) : (
          <button
            key={i}
            onClick={() => {
              setRenamingIndex(i);
              setRenameValue(speaker);
            }}
            className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-200"
            title="Click to rename"
          >
            {speaker}
          </button>
        )
      )}
    </div>
  );
}

function PurposeBadge({ purpose }: { purpose: string }) {
  const colors: Record<string, string> = {
    primary: "bg-stone-100 text-stone-700",
    secondary: "bg-amber-50 text-amber-700",
    context: "bg-blue-50 text-blue-700",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
        colors[purpose] ?? "bg-stone-100 text-stone-600"
      }`}
    >
      {purpose}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
