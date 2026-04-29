"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useUiStore } from "@/lib/stores/uiStore";
import type { DocumentPurpose, Document } from "@/types";

const PURPOSE_LABELS: Record<DocumentPurpose, string> = {
  primary: "PRIMARY",
  secondary: "SECONDARY",
  context: "CONTEXT",
};

const PURPOSE_ORDER: DocumentPurpose[] = ["primary", "secondary", "context"];

/**
 * Document list grouped by purpose (PRIMARY, SECONDARY, CONTEXT)
 * as shown in the mockup's left panel.
 */
export function DocumentList({
  projectId,
  onUploadClick,
}: {
  projectId: string;
  onUploadClick: () => void;
}) {
  const currentDocumentId = useUiStore((s) => s.currentDocumentId);
  const setCurrentDocument = useUiStore((s) => s.setCurrentDocument);

  const documents = useLiveQuery(
    () =>
      db.documents
        .where("projectId")
        .equals(projectId)
        .filter((d) => d.deletedAt === null)
        .toArray(),
    [projectId]
  );

  if (!documents) return null;

  const grouped = groupByPurpose(documents);

  return (
    <div className="flex flex-col py-2">
      {PURPOSE_ORDER.map((purpose) => {
        const docs = grouped[purpose] ?? [];
        if (docs.length === 0 && purpose !== "primary") return null;

        return (
          <div key={purpose} className="mb-3">
            <div className="flex items-center justify-between px-4 py-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                {PURPOSE_LABELS[purpose]} &middot; {docs.length}
              </span>
              {purpose === "primary" && (
                <button
                  onClick={onUploadClick}
                  className="text-xs text-stone-400 hover:text-stone-600"
                  title="Upload document"
                >
                  +
                </button>
              )}
            </div>

            {docs.length === 0 ? (
              <button
                onClick={onUploadClick}
                className="mx-4 mt-1 w-[calc(100%-2rem)] rounded border border-dashed border-stone-200 py-2 text-xs text-stone-400 hover:border-stone-300 hover:text-stone-500"
              >
                Upload your first document
              </button>
            ) : (
              <ul className="space-y-px">
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      onClick={() => setCurrentDocument(doc.id)}
                      className={`flex w-full items-center gap-2 px-4 py-1 text-left text-sm ${
                        currentDocumentId === doc.id
                          ? "bg-stone-100 font-medium text-stone-900"
                          : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      <StatusDot status={doc.status} />
                      <span className="truncate">{doc.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusDot({ status }: { status: Document["status"] }) {
  if (status === "ready") return null;
  const colors = {
    pending: "bg-amber-400",
    processing: "bg-blue-400 animate-pulse",
    error: "bg-red-400",
  };
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[status]}`}
      title={status}
    />
  );
}

function groupByPurpose(
  docs: Document[]
): Record<DocumentPurpose, Document[]> {
  const result: Record<DocumentPurpose, Document[]> = {
    primary: [],
    secondary: [],
    context: [],
  };
  for (const doc of docs) {
    result[doc.purpose].push(doc);
  }
  return result;
}
