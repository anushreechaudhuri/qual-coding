/**
 * BYO API key storage.
 *
 * Keys are stored in localStorage, never sent to our server. The API
 * route proxies read keys from request headers, not from this storage.
 * This module is the only place that reads/writes key values.
 */

const STORAGE_PREFIX = "qual-coding:api-key:";

export type ApiKeyName = "gemini" | "reducto" | "anthropic" | "openai";

const KEY_NAMES: ApiKeyName[] = ["gemini", "reducto", "anthropic", "openai"];

function storageKey(name: ApiKeyName): string {
  return `${STORAGE_PREFIX}${name}`;
}

export function getApiKey(name: ApiKeyName): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(storageKey(name));
  } catch {
    return null;
  }
}

export function setApiKey(name: ApiKeyName, value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (value.trim() === "") {
      localStorage.removeItem(storageKey(name));
    } else {
      localStorage.setItem(storageKey(name), value.trim());
    }
  } catch {
    // localStorage full or unavailable (e.g., private browsing)
  }
}

export function clearApiKey(name: ApiKeyName): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(name));
  } catch {
    // ignore
  }
}

export function getAllApiKeys(): Record<ApiKeyName, string | null> {
  const result = {} as Record<ApiKeyName, string | null>;
  for (const name of KEY_NAMES) {
    result[name] = getApiKey(name);
  }
  return result;
}

/**
 * Display labels and descriptions for the settings UI.
 */
export const API_KEY_CONFIG: Record<
  ApiKeyName,
  { label: string; description: string; placeholder: string }
> = {
  gemini: {
    label: "Gemini",
    description: "Used for audio transcription with speaker diarization",
    placeholder: "AIzaSy...",
  },
  reducto: {
    label: "Reducto",
    description: "Used for parsing PDFs, scans, and handwritten documents",
    placeholder: "Your Reducto API key",
  },
  anthropic: {
    label: "Anthropic",
    description: "Used for AI-assisted codebook suggestions (phase 2)",
    placeholder: "sk-ant-...",
  },
  openai: {
    label: "OpenAI",
    description: "Used for AI-assisted analysis (phase 2)",
    placeholder: "sk-proj-...",
  },
};
