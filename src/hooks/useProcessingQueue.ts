"use client";

import { useEffect } from "react";
import { processNextPending } from "@/lib/ingestion/processingQueue";

/**
 * Triggers the processing queue on mount and when connectivity is restored.
 * Place this hook in the authenticated layout so it runs while the app is open.
 */
export function useProcessingQueue() {
  useEffect(() => {
    // Process any pending documents on mount
    processNextPending();

    // Re-check when coming back online
    function handleOnline() {
      processNextPending();
    }

    // Re-check when the tab regains focus (user may have configured keys)
    function handleFocus() {
      processNextPending();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
}
