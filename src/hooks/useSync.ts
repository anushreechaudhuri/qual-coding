"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { startSyncLoop, stopSyncLoop, runSync, getSyncState } from "@/lib/sync/syncEngine";

export function useSync() {
  const { data: session } = useSession();
  const disabledRef = useRef(false);

  useEffect(() => {
    const token = session?.accessToken;
    console.log("[sync] Session check:", {
      hasSession: !!session,
      hasToken: !!token,
      tokenPreview: token ? token.slice(0, 20) + "..." : "none",
      disabled: disabledRef.current,
      error: session?.error,
    });

    if (!token || disabledRef.current) return;

    async function testAndStart() {
      console.log("[sync] Testing Drive access...");
      await runSync(token!);
      const state = getSyncState();
      console.log("[sync] Test result:", state.status, state.error);

      if (state.status === "auth_required") {
        console.log("[sync] Drive scope not available, disabling sync");
        disabledRef.current = true;
        return;
      }

      console.log("[sync] Starting sync loop");
      startSyncLoop(() => session!.accessToken ?? null);
    }

    testAndStart();

    return () => stopSyncLoop();
  }, [session?.accessToken]);
}
