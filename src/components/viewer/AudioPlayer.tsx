"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";

/**
 * Waveform audio player using wavesurfer.js.
 *
 * Loads audio from a Blob URL (sourced from the binaryAssets table in
 * IndexedDB). Reports the current playback time so the parent can
 * highlight the active segment.
 */
export function AudioPlayer({
  blobUrl,
  onTimeUpdate,
}: {
  blobUrl: string | null;
  onTimeUpdate: (currentTime: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !blobUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#d6d3d1",
      progressColor: "#78716c",
      cursorColor: "#1c1917",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 48,
      normalize: true,
    });

    ws.load(blobUrl);

    ws.on("ready", () => {
      setDuration(ws.getDuration());
    });

    ws.on("audioprocess", () => {
      const time = ws.getCurrentTime();
      setCurrentTime(time);
      onTimeUpdate(time);
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [blobUrl, onTimeUpdate]);

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const seekTo = useCallback((timeStr: string) => {
    const ws = wavesurferRef.current;
    if (!ws || !duration) return;
    const seconds = parseTimestamp(timeStr);
    ws.seekTo(seconds / duration);
  }, [duration]);

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center py-4 text-xs text-stone-400">
        Audio file not available
      </div>
    );
  }

  return (
    <div className="border-b border-stone-100 px-6 py-3">
      <div ref={containerRef} className="mb-2" />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <span className="text-xs text-stone-500 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

/**
 * Expose the seekTo function for external use (e.g., clicking a segment).
 * Parent components should use a ref or callback pattern.
 */
export { parseTimestamp };

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
