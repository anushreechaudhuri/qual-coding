"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";
import { exportFullBackup, importFullBackup } from "@/lib/export/backup";
import { saveToFile, loadFromFile } from "@/lib/sync/localFolderSync";
import { DriveFolderPicker } from "@/components/sync/DriveFolderPicker";

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
          <SharedKeysUnlock />
        </section>

        <section className="space-y-4 border-t border-stone-200 pt-8">
          <div>
            <h2 className="text-sm font-medium text-stone-900">Google Drive Sync</h2>
            <p className="mt-1 text-xs text-stone-500">
              Choose where in your Google Drive to store synced data.
              A &ldquo;QualCoding&rdquo; subfolder is created automatically.
            </p>
          </div>
          <DriveFolderPicker />
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

        <FolderSyncSection />
      </div>
    </div>
  );
}

function FolderSyncSection() {
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [includeBinaries, setIncludeBinaries] = useState(false);
  // Track if binary encoding is what's slow
  const [binaryWarning] = useState(() => "Warning: including audio files encodes them as base64, which can be very slow for large files (100MB+). Consider saving without binaries first.");
  const [syncing, setSyncing] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSyncing(true);
    setSyncStatus("Starting...");
    try {
      const result = await saveToFile({
        includeBinaries,
        onProgress: (msg) => setSyncStatus(msg),
      });
      const sizeMB = (result.size / (1024 * 1024)).toFixed(1);
      setSyncStatus(`Saved (${sizeMB}MB). Save to a cloud drive folder for automatic backup.`);
      setTimeout(() => setSyncStatus(null), 8000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      if (msg === "Cancelled") {
        setSyncStatus(null);
      } else {
        setSyncStatus(`Save failed: ${msg}`);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleRestore(file: File) {
    setSyncing(true);
    setSyncStatus("Restoring...");
    try {
      const result = await loadFromFile(file, (msg) => setSyncStatus(msg));
      const summary = Object.entries(result.tables)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      setSyncStatus(`Restored: ${summary}`);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err) {
      setSyncStatus(`Restore failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="space-y-4 border-t border-stone-200 pt-8">
      <div>
        <h2 className="text-sm font-medium text-stone-900">Save &amp; Sync</h2>
        <p className="mt-1 text-xs text-stone-500">
          Save all your data to a file. Choose a location inside Google Drive,
          Dropbox, pCloud, or OneDrive and it syncs to the cloud automatically.
          Restore on any device by loading the file.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={includeBinaries}
          onChange={(e) => setIncludeBinaries(e.target.checked)}
          className="rounded border-stone-300"
        />
        Include audio/PDF files
      </label>
      {includeBinaries && (
        <p className="text-[10px] text-amber-600 ml-6">
          {binaryWarning}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={syncing}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {syncing ? "Working..." : "Save to file"}
        </button>
        <button
          onClick={() => restoreRef.current?.click()}
          disabled={syncing}
          className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Restore from file
        </button>
        <input
          ref={restoreRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleRestore(file);
          }}
        />
      </div>

      {syncStatus && (
        <p className={`text-xs ${syncStatus.includes("failed") ? "text-red-600" : "text-green-600"}`}>
          {syncStatus}
        </p>
      )}

      <p className="text-[10px] text-stone-400">
        Tip: In Chrome/Edge, "Save to file" lets you pick the save location.
        Choose a folder inside your cloud drive for automatic backup. The file
        contains all projects, codes, transcripts, and memos
        {includeBinaries ? " plus audio/PDF files" : ""}.
      </p>
    </section>
  );
}

function SharedKeysUnlock() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    if (!password.trim()) return;
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/shared-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.status === 404) {
        setStatus("Shared keys not available on this instance.");
        return;
      }

      if (res.status === 401) {
        setStatus("Wrong password.");
        return;
      }

      if (!res.ok) {
        setStatus("Something went wrong.");
        return;
      }

      const { keys } = await res.json();
      let count = 0;

      for (const [name, value] of Object.entries(keys)) {
        if (value) {
          localStorage.setItem(`qual-coding:api-key:${name}`, value as string);
          count++;
        }
      }

      setStatus(`${count} API keys loaded. Reload the page to use them.`);
      setPassword("");
    } catch {
      setStatus("Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <p className="text-xs text-stone-500 mb-2">
        Have a shared access password? Enter it to load API keys.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          placeholder="Shared password"
          className="flex-1 rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
        />
        <button
          onClick={handleUnlock}
          disabled={loading || !password.trim()}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          {loading ? "..." : "Unlock"}
        </button>
      </div>
      {status && (
        <p className={`mt-1 text-xs ${status.includes("loaded") ? "text-green-600" : "text-red-500"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
