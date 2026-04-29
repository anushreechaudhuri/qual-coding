"use client";

import type { Document } from "@/types";

/**
 * Header bar showing document metadata: title, date, language badge,
 * purpose badge, and audio-specific info (speaker count, duration).
 */
export function DocumentHeader({ document: doc }: { document: Document }) {
  return (
    <div className="border-b border-stone-100 px-6 py-3">
      <h2 className="text-lg font-semibold text-stone-900 font-serif">
        {doc.title}
      </h2>
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
