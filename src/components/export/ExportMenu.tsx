"use client";

import { useState } from "react";
import {
  exportCodedSegmentsCSV,
  exportCodebookCSV,
  exportProjectJSON,
  exportMemosMarkdown,
  downloadFile,
} from "@/lib/export/exporters";

export function ExportMenu({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport(
    type: "segments" | "codebook" | "project" | "memos"
  ) {
    setExporting(true);
    try {
      const slug = projectName.toLowerCase().replace(/\s+/g, "-");
      switch (type) {
        case "segments": {
          const csv = await exportCodedSegmentsCSV(projectId);
          downloadFile(csv, `${slug}-coded-segments.csv`, "text/csv");
          break;
        }
        case "codebook": {
          const csv = await exportCodebookCSV(projectId);
          downloadFile(csv, `${slug}-codebook.csv`, "text/csv");
          break;
        }
        case "project": {
          const json = await exportProjectJSON(projectId);
          downloadFile(json, `${slug}-project.json`, "application/json");
          break;
        }
        case "memos": {
          const md = await exportMemosMarkdown(projectId);
          downloadFile(md, `${slug}-memos.md`, "text/markdown");
          break;
        }
      }
    } finally {
      setExporting(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-stone-400 hover:text-stone-600"
      >
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-48 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
            <ExportOption
              label="Coded Segments (CSV)"
              onClick={() => handleExport("segments")}
              disabled={exporting}
            />
            <ExportOption
              label="Codebook (CSV)"
              onClick={() => handleExport("codebook")}
              disabled={exporting}
            />
            <ExportOption
              label="Full Project (JSON)"
              onClick={() => handleExport("project")}
              disabled={exporting}
            />
            <ExportOption
              label="Memos (Markdown)"
              onClick={() => handleExport("memos")}
              disabled={exporting}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ExportOption({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
