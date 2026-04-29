"use client";

import { useState, useCallback, useEffect } from "react";
import {
  type ApiKeyName,
  getApiKey,
  setApiKey,
  clearApiKey,
  getAllApiKeys,
} from "@/lib/settings";

/**
 * React hook for reading and writing BYO API keys.
 * Wraps localStorage access with React state so the UI updates on changes.
 */
export function useApiKeys() {
  const [keys, setKeys] = useState<Record<ApiKeyName, string | null>>({
    gemini: null,
    reducto: null,
    anthropic: null,
    openai: null,
  });

  useEffect(() => {
    setKeys(getAllApiKeys());
  }, []);

  const saveKey = useCallback((name: ApiKeyName, value: string) => {
    setApiKey(name, value);
    setKeys((prev) => ({ ...prev, [name]: value.trim() || null }));
  }, []);

  const removeKey = useCallback((name: ApiKeyName) => {
    clearApiKey(name);
    setKeys((prev) => ({ ...prev, [name]: null }));
  }, []);

  const hasKey = useCallback(
    (name: ApiKeyName) => keys[name] !== null && keys[name] !== "",
    [keys]
  );

  return { keys, saveKey, removeKey, hasKey };
}
