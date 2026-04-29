"use client";

import type { AudioSegment } from "@/types";

/**
 * Renders audio transcription segments with speaker labels, timestamps,
 * original text, and translation. Clicking a segment calls onSeek with
 * the segment's timestamp for audio playback synchronization.
 *
 * The content rendered here follows the same character offset invariant:
 * the text displayed matches what's stored in the segments array.
 */
export function SegmentList({
  segments,
  activeSegmentIndex,
  onSeek,
}: {
  segments: AudioSegment[];
  activeSegmentIndex: number | null;
  onSeek: (timestamp: string) => void;
}) {
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
        <button
          key={segment.index}
          onClick={() => onSeek(segment.timestamp)}
          className={`w-full px-6 py-3 text-left transition-colors hover:bg-stone-50 ${
            activeSegmentIndex === segment.index ? "bg-stone-50" : ""
          }`}
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-medium text-stone-500">
              {segment.speaker}
            </span>
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
        </button>
      ))}
    </div>
  );
}
