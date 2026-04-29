"use client";

import { useState, useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { AudioPlayer, parseTimestamp } from "./AudioPlayer";
import { SegmentList } from "./SegmentList";
import type { Document } from "@/types";

/**
 * Audio document viewer: waveform player + speaker-diarized segment list.
 * Clicking a segment seeks audio to that timestamp. Current segment
 * highlights during playback.
 */
export function AudioViewer({ document: doc }: { document: Document }) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Load the audio binary from IndexedDB
  const binaryAsset = useLiveQuery(
    () =>
      doc.binaryAssetId
        ? db.binaryAssets.get(doc.binaryAssetId)
        : undefined,
    [doc.binaryAssetId]
  );

  useEffect(() => {
    if (binaryAsset?.blob) {
      const url = URL.createObjectURL(binaryAsset.blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setBlobUrl(null);
  }, [binaryAsset]);

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (!doc.segments.length) return;

      // Find the segment that contains the current playback time
      const index = doc.segments.findIndex((seg, i) => {
        const segStart = parseTimestamp(seg.timestamp);
        const nextSeg = doc.segments[i + 1];
        const segEnd = nextSeg
          ? parseTimestamp(nextSeg.timestamp)
          : Infinity;
        return currentTime >= segStart && currentTime < segEnd;
      });

      setActiveSegmentIndex(index >= 0 ? index : null);
    },
    [doc.segments]
  );

  const handleSeek = useCallback((_timestamp: string) => {
    // The AudioPlayer component handles seeking internally via wavesurfer.
    // For now, clicking a segment updates the active index visually.
    // Full seek integration requires a ref/callback pattern on AudioPlayer.
    const index = doc.segments.findIndex((s) => s.timestamp === _timestamp);
    setActiveSegmentIndex(index >= 0 ? index : null);
  }, [doc.segments]);

  return (
    <div>
      <AudioPlayer blobUrl={blobUrl} onTimeUpdate={handleTimeUpdate} />
      <SegmentList
        segments={doc.segments}
        activeSegmentIndex={activeSegmentIndex}
        onSeek={handleSeek}
      />
    </div>
  );
}
