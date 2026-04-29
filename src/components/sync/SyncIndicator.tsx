"use client";

import { useState, useEffect } from "react";
import { getSyncState, onSyncStateChange, type SyncStatus } from "@/lib/sync/syncEngine";

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string }> = {
  idle: { label: "Not synced", color: "bg-stone-300" },
  syncing: { label: "Syncing...", color: "bg-blue-400 animate-pulse" },
  synced: { label: "Synced", color: "bg-green-400" },
  error: { label: "Sync error", color: "bg-red-400" },
  offline: { label: "Offline", color: "bg-amber-400" },
  auth_required: { label: "Sign in needed", color: "bg-red-400" },
};

export function SyncIndicator() {
  const [state, setState] = useState(getSyncState());

  useEffect(() => {
    return onSyncStateChange(setState);
  }, []);

  const config = STATUS_CONFIG[state.status];

  return (
    <div className="flex items-center gap-1.5" title={state.error ?? config.label}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.color}`} />
      <span className="text-[10px] text-stone-400">{config.label}</span>
    </div>
  );
}
