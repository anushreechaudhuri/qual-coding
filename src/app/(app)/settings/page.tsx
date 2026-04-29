"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";
import { exportFullBackup, importFullBackup } from "@/lib/export/backup";

export default function SettingsPage() {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExportBackup() {
    setBackupStatus("Exporting...");
    try {
      await exportFullBackup();
      setBackupStatus("Backup downloaded");
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (err) {
      setBackupStatus(`Export failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  async function handleImportBackup(file: File) {
    setRestoreStatus("Restoring...");
    try {
      const { counts } = await importFullBackup(file);
      const summary = Object.entries(counts)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      setRestoreStatus(`Restored: ${summary}`);
      setTimeout(() => setRestoreStatus(null), 5000);
    } catch (err) {
      setRestoreStatus(`Restore failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
          <Link
            href="/projects"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Back to projects
          </Link>
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-stone-900">API Keys</h2>
            <p className="mt-1 text-xs text-stone-500">
              Keys are stored in your browser only and sent directly to the
              respective API services. They are never stored on our server.
            </p>
          </div>
          <ApiKeyForm />
        </section>

        <section className="space-y-4 border-t border-stone-200 pt-8">
          <div>
            <h2 className="text-sm font-medium text-stone-900">Data Backup</h2>
            <p className="mt-1 text-xs text-stone-500">
              Export all your data (projects, documents, codes, codings, memos)
              to a JSON file. Use this before clearing browser data or to
              transfer your work to another device.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportBackup}
              className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
            >
              Export backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
            >
              Restore from backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportBackup(file);
              }}
            />
          </div>

          {backupStatus && (
            <p className={`text-xs ${backupStatus.includes("failed") ? "text-red-600" : "text-green-600"}`}>
              {backupStatus}
            </p>
          )}
          {restoreStatus && (
            <p className={`text-xs ${restoreStatus.includes("failed") ? "text-red-600" : "text-green-600"}`}>
              {restoreStatus}
            </p>
          )}

          <p className="text-[10px] text-stone-400">
            Backups include all text data but not uploaded binary files (audio, PDFs).
            Documents will show as "pending" if the original files need re-processing.
          </p>
        </section>
      </div>
    </div>
  );
}
