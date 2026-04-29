"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { deleteDocument } from "@/lib/db/operations";
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

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  function toggleSection(purpose: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(purpose)) next.delete(purpose);
      else next.add(purpose);
      return next;
    });
  }

  if (!documents) return null;

  const grouped = groupByPurpose(documents);

  return (
    <div className="flex flex-col py-2">
      {PURPOSE_ORDER.map((purpose) => {
        const docs = grouped[purpose] ?? [];
        if (docs.length === 0 && purpose !== "primary") return null;
        const isCollapsed = collapsedSections.has(purpose);

        return (
          <div key={purpose} className="mb-3">
            <div className="flex items-center justify-between px-4 py-1">
              <button
                onClick={() => toggleSection(purpose)}
                className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-stone-400 hover:text-stone-600"
              >
                <span className="text-[9px]">{isCollapsed ? "▶" : "▼"}</span>
                {PURPOSE_LABELS[purpose]} &middot; {docs.length}
              </button>
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

            {isCollapsed ? null : docs.length === 0 ? (
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
                    <div
                      onClick={() => setCurrentDocument(doc.id)}
                      className={`group flex w-full items-center gap-2 px-4 py-1 text-left text-sm cursor-pointer ${
                        currentDocumentId === doc.id
                          ? "bg-stone-100 font-medium text-stone-900"
                          : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      <StatusDot status={doc.status} />
                      <span className="flex-1 truncate">{doc.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${doc.title}"?`)) {
                            deleteDocument(doc.id);
                            if (currentDocumentId === doc.id) {
                              setCurrentDocument(null);
                            }
                          }
                        }}
                        className="hidden shrink-0 text-[10px] text-stone-400 hover:text-red-500 group-hover:inline"
                        title="Delete document"
                      >
                        ×
                      </button>
                    </div>
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
