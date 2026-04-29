"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { startSyncLoop, stopSyncLoop } from "@/lib/sync/syncEngine";

/**
 * Starts the Drive sync loop when the user is authenticated AND
 * has Drive scope in their token. Disabled until Drive scope is
 * re-added to the OAuth config.
 */
export function useSync() {
  const { data: session } = useSession();

  useEffect(() => {
    // Drive sync is disabled until the drive.appdata scope is configured
    // in the Google Cloud Console OAuth consent screen. Re-enable by
    // uncommenting the scope in src/lib/auth.ts and removing this guard.
    const hasDriveScope = session?.accessToken && false; // TODO: enable when Drive scope is added

    if (!hasDriveScope) return;

    startSyncLoop(() => session.accessToken ?? null);

    return () => stopSyncLoop();
  }, [session?.accessToken]);
}
