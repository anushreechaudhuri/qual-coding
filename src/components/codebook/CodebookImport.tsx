"use client";

import { useState, useCallback } from "react";
import { parseCodebook, type ImportedCode } from "@/lib/codebook/importParser";
import { createCode } from "@/lib/db/operations";

/**
 * Codebook import flow: upload a CSV/JSON file, review the parsed codes,
 * then commit them to the database with "imported" provenance.
 */
export function CodebookImport({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [codes, setCodes] = useState<ImportedCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCodebook(text, file.name);
      if (parsed.length === 0) {
        setError("No valid codes found in file");
        return;
      }
      setCodes(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  }, []);

  async function handleImport() {
    if (!codes) return;
    setImporting(true);

    try {
      // Create parent codes first, then children
      const parentNames = new Set(
        codes.filter((c) => c.parent).map((c) => c.parent!)
      );
      const parentIdMap = new Map<string, string>();

      // First pass: create codes without parents (or whose parents aren't in the import)
      for (const code of codes) {
        if (!code.parent || !parentNames.has(code.name)) {
          if (!code.parent) {
            const created = await createCode({
              projectId,
              name: code.name,
              parentId: null,
              definition: code.definition,
              color: code.color,
              provenance: "imported",
            });
            parentIdMap.set(code.name, created.id);
          }
        }
      }

      // Second pass: create parent codes that were referenced but not yet created
      for (const code of codes) {
        if (!code.parent && !parentIdMap.has(code.name)) {
          const created = await createCode({
            projectId,
            name: code.name,
            parentId: null,
            definition: code.definition,
            color: code.color,
            provenance: "imported",
          });
          parentIdMap.set(code.name, created.id);
        }
      }

      // Third pass: create child codes
      for (const code of codes) {
        if (code.parent) {
          const parentId = parentIdMap.get(code.parent) ?? null;
          await createCode({
            projectId,
            name: code.name,
            parentId,
            definition: code.definition,
            color: code.color,
            provenance: "imported",
          });
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-stone-900">
          Import codebook
        </h2>

        {!codes ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-stone-600">
              Upload a CSV or JSON file with columns: name, parent, definition,
              color.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="block text-sm text-stone-600"
              />
              <button
                onClick={() => {
                  const template = "name,parent,definition,color\nLand,,\"Themes related to land\",#ef4444\nDispossession,Land,\"Loss of land access\",#f97316\nCompensation,Land,\"Payment for land\",#eab308";
                  const blob = new Blob([template], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "codebook-template.csv";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="shrink-0 rounded border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-50"
              >
                Download template
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-stone-600">
              Review {codes.length} codes before importing:
            </p>
            <div className="max-h-64 overflow-y-auto rounded border border-stone-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    <th className="px-3 py-1.5 text-left font-medium text-stone-600">
                      Name
                    </th>
                    <th className="px-3 py-1.5 text-left font-medium text-stone-600">
                      Parent
                    </th>
                    <th className="px-3 py-1.5 text-left font-medium text-stone-600">
                      Color
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code, i) => (
                    <tr key={i} className="border-b border-stone-50">
                      <td className="px-3 py-1.5">{code.name}</td>
                      <td className="px-3 py-1.5 text-stone-500">
                        {code.parent ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{ backgroundColor: code.color }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCodes(null)}
                className="rounded-md px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
              >
                {importing
                  ? "Importing..."
                  : `Import ${codes.length} codes`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
