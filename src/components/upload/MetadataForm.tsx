"use client";

import type { DocumentPurpose } from "@/types";

export interface DocumentMetadataValues {
  purpose: DocumentPurpose;
  language: string;
  dateCollected: string;
  notes: string;
}

const LANGUAGES = [
  "Bangla",
  "English",
  "Hindi",
  "Indonesian",
  "Urdu",
  "Other",
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

      {/* Language and date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="doc-language"
            className="block text-sm font-medium text-stone-700"
          >
            Language
          </label>
          <select
            id="doc-language"
            value={values.language}
            onChange={(e) => update({ language: e.target.value })}
            className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-400 focus:outline-none"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
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
