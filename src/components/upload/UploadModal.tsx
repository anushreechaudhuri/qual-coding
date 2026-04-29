"use client";

import { useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { MetadataForm, type DocumentMetadataValues } from "./MetadataForm";
import { routeFile } from "@/lib/ingestion/fileRouter";
import { ingestTextFile } from "@/lib/ingestion/textIngester";
import { estimateProcessing } from "@/lib/ingestion/estimates";
import { createDocument, createBinaryAsset } from "@/lib/db/operations";
import type { DocumentPurpose } from "@/types";

export function UploadModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadataValues>({
    purpose: "primary" as DocumentPurpose,
    language: "Bangla",
    dateCollected: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);

    try {
      const pipeline = routeFile(file);

      if (pipeline === "text") {
        await ingestTextFile({
          file,
          projectId,
          ...metadata,
        });
        onClose();
        return;
      }

      // For Reducto and Gemini pipelines: create a pending document and store the binary.
      // The actual API processing happens in Units 5 and 6. For now, we store the
      // file and mark the document as pending so the processing queue picks it up.
      const titleBase = file.name.replace(/\.[^.]+$/, "");

      const binaryAsset = await createBinaryAsset(
        "",  // documentId filled after document creation
        file,
        file.type
      );

      const doc = await createDocument({
        projectId,
        title: titleBase,
        purpose: metadata.purpose,
        language: metadata.language,
        dateCollected: metadata.dateCollected,
        notes: metadata.notes,
        fileType: file.type || `application/${file.name.split(".").pop()}`,
        status: "pending",
        content: "",
        translationContent: null,
        segments: [],
        metadata: {
          originalFileName: file.name,
          fileSize: file.size,
        },
        binaryAssetId: binaryAsset.id,
        errorMessage: null,
      });

      // Link the binary asset back to the document
      const { db } = await import("@/lib/db/schema");
      await db.binaryAssets.update(binaryAsset.id, { documentId: doc.id });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            Add a document
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600"
          >
            &times;
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {file ? (
            <div className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="truncate text-sm text-stone-700">
                {file.name}
              </span>
              <button
                onClick={() => setFile(null)}
                className="ml-2 shrink-0 text-xs text-stone-400 hover:text-stone-600"
              >
                change
              </button>
            </div>
          ) : (
            <FileDropzone onFileSelect={setFile} />
          )}

          {file && (
            <>
              {/* Processing estimate */}
              {(() => {
                const est = estimateProcessing(file.size, file.type || "application/octet-stream");
                const pipeline = routeFile(file);
                if (pipeline === "text") return null;
                return (
                  <div className="rounded-md bg-stone-50 border border-stone-100 px-3 py-2 text-xs text-stone-600 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Est. time:</span>
                      <span className="font-medium">{est.timeRange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Est. cost:</span>
                      <span className="font-medium">{est.costRange}</span>
                    </div>
                    <p className="text-[10px] text-stone-400 pt-0.5">{est.details}</p>
                  </div>
                );
              })()}

              <MetadataForm values={metadata} onChange={setMetadata} />

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="rounded-md px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 border border-blue-200"
                >
                  {submitting ? "Adding..." : "Add and process"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
