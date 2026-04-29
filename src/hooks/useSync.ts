"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { startSyncLoop, stopSyncLoop } from "@/lib/sync/syncEngine";

/**
 * Starts the Drive sync loop when the user is authenticated.
 * Uses the access token from the Auth.js session.
 */
export function useSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.accessToken) return;

    startSyncLoop(() => session.accessToken ?? null);

    return () => stopSyncLoop();
  }, [session?.accessToken]);
}
