"use client";

import type { Document } from "@/types";
import { updateDocument } from "@/lib/db/operations";
import { processNextPending } from "@/lib/ingestion/processingQueue";
import { DocumentHeader } from "./DocumentHeader";
import { MarkdownViewer } from "./MarkdownViewer";
import { AudioViewer } from "./AudioViewer";

/**
 * Routes to the correct viewer based on document type.
 * Audio documents get the waveform player + segment list.
 * Everything else gets the markdown text viewer.
 */
export function DocumentViewer({ document: doc }: { document: Document }) {
  if (doc.status === "pending") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        <p className="text-sm text-stone-500">
          Waiting to process: {doc.title}
        </p>
        <p className="text-xs text-stone-400">
          Will process when API keys are configured and connectivity is available.
        </p>
      </div>
    );
  }

  if (doc.status === "processing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
        <p className="text-sm text-stone-500">Processing: {doc.title}</p>
      </div>
    );
  }

  if (doc.status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm text-red-600">Processing failed</p>
        <p className="text-xs text-stone-500 max-w-md">{doc.errorMessage}</p>
        <button
          onClick={async () => {
            await updateDocument(doc.id, {
              status: "pending",
              errorMessage: null,
            });
            processNextPending();
          }}
          className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
        >
          Retry
        </button>
        <p className="text-[10px] text-stone-400">
          The file is cached locally. Retry will re-process it.
        </p>
      </div>
    );
  }

  const isAudio = doc.fileType.startsWith("audio/");

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <DocumentHeader document={doc} />
      {isAudio ? (
        <AudioViewer document={doc} />
      ) : (
        <MarkdownViewer document={doc} />
      )}
    </div>
  );
}
