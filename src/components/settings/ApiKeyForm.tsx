"use client";

import { useState } from "react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { API_KEY_CONFIG, type ApiKeyName } from "@/lib/settings";

/**
 * Form for entering BYO API keys. Keys are saved to localStorage
 * immediately on blur or Enter. Masking toggle lets users verify
 * their keys without exposing them to shoulder-surfers.
 */
export function ApiKeyForm() {
  return (
    <div className="space-y-6">
      {(Object.keys(API_KEY_CONFIG) as ApiKeyName[]).map((name) => (
        <ApiKeyField key={name} name={name} />
      ))}
    </div>
  );
}

function ApiKeyField({ name }: { name: ApiKeyName }) {
  const { keys, saveKey, removeKey } = useApiKeys();
  const config = API_KEY_CONFIG[name];
  const [value, setValue] = useState(keys[name] ?? "");
  const [visible, setVisible] = useState(false);

  function handleSave() {
    saveKey(name, value);
  }

  function handleClear() {
    setValue("");
    removeKey(name);
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={`api-key-${name}`}
        className="block text-sm font-medium text-stone-900"
      >
        {config.label}
      </label>
      <p className="text-xs text-stone-500">{config.description}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={`api-key-${name}`}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={config.placeholder}
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600"
          >
            {visible ? "hide" : "show"}
          </button>
        </div>
        {keys[name] && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-stone-200 px-3 py-2 text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-700"
          >
            clear
          </button>
        )}
      </div>
      {keys[name] && (
        <p className="text-xs text-green-600">Saved</p>
      )}
    </div>
  );
}
