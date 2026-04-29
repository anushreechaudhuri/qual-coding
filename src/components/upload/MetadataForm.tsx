"use client";

import { useState, useMemo } from "react";
import type { DocumentPurpose } from "@/types";

export interface DocumentMetadataValues {
  purpose: DocumentPurpose;
  language: string;
  dateCollected: string;
  notes: string;
}

const COMMON_LANGUAGES = [
  "Bangla", "English", "Hindi", "Indonesian", "Urdu",
  "Arabic", "Chinese (Mandarin)", "French", "German", "Japanese",
  "Korean", "Malay", "Nepali", "Pashto", "Persian",
  "Portuguese", "Punjabi", "Russian", "Sindhi", "Spanish",
  "Swahili", "Tamil", "Telugu", "Thai", "Turkish",
  "Ukrainian", "Vietnamese",
];

const PURPOSE_OPTIONS: { value: DocumentPurpose; label: string; sub: string }[] = [
  { value: "primary", label: "Primary", sub: "Interviews, FGD, notes" },
  { value: "secondary", label: "Secondary", sub: "News, legal, reports" },
  { value: "context", label: "Context", sub: "Background" },
];

export function MetadataForm({
  values,
  onChange,
}: {
  values: DocumentMetadataValues;
  onChange: (values: DocumentMetadataValues) => void;
}) {
  function update(partial: Partial<DocumentMetadataValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <div className="space-y-4">
      {/* Purpose selector */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          What is this for?
        </label>
        <div className="flex gap-2">
          {PURPOSE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ purpose: opt.value })}
              className={`flex-1 rounded-md border px-3 py-2 text-center transition-colors ${
                values.purpose === opt.value
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-stone-200 text-stone-600 hover:border-stone-300"
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-[11px] text-stone-500">{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Language selector (multi with search) */}
      <div>
        <label className="block text-sm font-medium text-stone-700">
          Language(s)
        </label>
        <LanguagePicker
          value={values.language}
          onChange={(lang) => update({ language: lang })}
        />
      </div>

      {/* Date */}
      <div>
        <label
          htmlFor="doc-date"
          className="block text-sm font-medium text-stone-700"
        >
          Date collected
        </label>
        <input
          id="doc-date"
          type="date"
          value={values.dateCollected}
          onChange={(e) => update({ dateCollected: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
        />
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="doc-notes"
          className="block text-sm font-medium text-stone-700"
        >
          Notes{" "}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <textarea
          id="doc-notes"
          value={values.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="FGD with six women farmers in Char Bhardakhata. Conducted with translator."
          rows={3}
          className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none resize-none"
        />
      </div>
    </div>
  );
}

/**
 * Multi-language picker with search. Selected languages shown as chips.
 * Stores as comma-separated string (e.g., "Bangla, English").
 */
function LanguagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = value ? value.split(", ").filter(Boolean) : [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return COMMON_LANGUAGES.filter(
      (lang) => lang.toLowerCase().includes(q) && !selected.includes(lang)
    );
  }, [search, selected]);

  function addLanguage(lang: string) {
    const updated = [...selected, lang];
    onChange(updated.join(", "));
    setSearch("");
  }

  function removeLanguage(lang: string) {
    const updated = selected.filter((l) => l !== lang);
    onChange(updated.join(", "));
  }

  function addCustom() {
    if (search.trim() && !selected.includes(search.trim())) {
      addLanguage(search.trim());
    }
  }

  return (
    <div className="mt-1 relative">
      {/* Selected chips */}
      <div className="flex flex-wrap gap-1 mb-1">
        {selected.map((lang, i) => (
          <span
            key={lang}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
              i === 0
                ? "bg-blue-100 text-blue-800"
                : "bg-stone-100 text-stone-600"
            }`}
          >
            {i === 0 && <span className="text-[9px] font-medium">primary</span>}
            {lang}
            <button
              onClick={() => removeLanguage(lang)}
              className="hover:text-red-500 ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Search input */}
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={selected.length ? "Add another language..." : "Search languages..."}
        className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) addLanguage(filtered[0]);
            else addCustom();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />

      {/* Dropdown */}
      {open && (search || selected.length === 0) && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg py-0.5">
            {filtered.length === 0 && search ? (
              <button
                onClick={addCustom}
                className="w-full px-3 py-1.5 text-left text-xs text-stone-600 hover:bg-stone-50"
              >
                Add &ldquo;{search}&rdquo;
              </button>
            ) : (
              filtered.slice(0, 12).map((lang) => (
                <button
                  key={lang}
                  onClick={() => addLanguage(lang)}
                  className="w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50"
                >
                  {lang}
                </button>
              ))
            )}
          </div>
        </>
      )}

      {selected.length > 1 && (
        <p className="text-[10px] text-stone-400 mt-1">
          First language is primary (used for transcription language detection)
        </p>
      )}
    </div>
  );
}
