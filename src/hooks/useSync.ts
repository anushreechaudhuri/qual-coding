"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { startSyncLoop, stopSyncLoop, runSync, getSyncState } from "@/lib/sync/syncEngine";

/**
 * Starts the Drive sync loop when authenticated. On first attempt,
 * if Drive returns 403 (no scope), disables sync silently instead
 * of showing "Sign in needed" forever.
 */
export function useSync() {
  const { data: session } = useSession();
  const disabledRef = useRef(false);

  useEffect(() => {
    if (!session?.accessToken || disabledRef.current) return;

    // Test Drive access before starting the loop
    async function testAndStart() {
      await runSync(session!.accessToken);
      const state = getSyncState();

      if (state.status === "auth_required") {
        // Drive scope not available (e.g., Vercel without ENABLE_DRIVE_SYNC)
        // Disable sync silently
        disabledRef.current = true;
        return;
      }

      startSyncLoop(() => session!.accessToken ?? null);
    }

    testAndStart();

    return () => stopSyncLoop();
  }, [session?.accessToken]);
}
