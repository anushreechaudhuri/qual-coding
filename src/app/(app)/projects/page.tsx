"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectList } from "@/components/projects/ProjectList";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { UploadModal } from "@/components/upload/UploadModal";
import { DocumentList } from "@/components/layout/DocumentList";
import { useUiStore } from "@/lib/stores/uiStore";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useProcessingQueue } from "@/hooks/useProcessingQueue";

export default function ProjectsPage() {
  useProcessingQueue();
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const currentProjectId = useUiStore((s) => s.currentProjectId);
  const currentDocumentId = useUiStore((s) => s.currentDocumentId);

  const currentProject = useLiveQuery(
    () => (currentProjectId ? db.projects.get(currentProjectId) : undefined),
    [currentProjectId]
  );

  const currentDocument = useLiveQuery(
    () => (currentDocumentId ? db.documents.get(currentDocumentId) : undefined),
    [currentDocumentId]
  );

  return (
    <>
      <AppShell
        header={
          <Header
            projectName={currentProject?.name ?? null}
            onCreateClick={() => setShowCreate(true)}
          />
        }
        left={
          currentProjectId ? (
            <div>
              <ProjectList onCreateClick={() => setShowCreate(true)} />
              <div className="border-t border-stone-100">
                <DocumentList
                  projectId={currentProjectId}
                  onUploadClick={() => setShowUpload(true)}
                />
              </div>
            </div>
          ) : (
            <ProjectList onCreateClick={() => setShowCreate(true)} />
          )
        }
        center={
          currentDocument ? (
            <DocumentPlaceholder
              title={currentDocument.title}
              status={currentDocument.status}
              content={currentDocument.content}
            />
          ) : currentProject ? (
            <ProjectCenter
              name={currentProject.name}
              onUploadClick={() => setShowUpload(true)}
            />
          ) : (
            <EmptyCenter onCreateClick={() => setShowCreate(true)} />
          )
        }
        right={
          currentProject ? <RightPlaceholder /> : <div />
        }
      />

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} />
      )}
      {showUpload && currentProjectId && (
        <UploadModal
          projectId={currentProjectId}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  );
}

function Header({
  projectName,
  onCreateClick,
}: {
  projectName: string | null;
  onCreateClick: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-stone-900">
          {projectName ?? "Qual Coding"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-stone-500">
        <button onClick={onCreateClick} className="hover:text-stone-700">
          New project
        </button>
        <Link href="/settings" className="hover:text-stone-700">
          Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="hover:text-stone-700"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function EmptyCenter({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-stone-500">
        Select a project or create a new one to get started.
      </p>
      <button
        onClick={onCreateClick}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
      >
        Create project
      </button>
    </div>
  );
}

function ProjectCenter({
  name,
  onUploadClick,
}: {
  name: string;
  onUploadClick: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-stone-500">{name}</p>
      <button
        onClick={onUploadClick}
        className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
      >
        Upload a document
      </button>
    </div>
  );
}

function DocumentPlaceholder({
  title,
  status,
  content,
}: {
  title: string;
  status: string;
  content: string;
}) {
  if (status === "pending") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        <p className="text-sm text-stone-500">
          Waiting to process: {title}
        </p>
        <p className="text-xs text-stone-400">
          Will process when API keys are configured and connectivity is available.
        </p>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
        <p className="text-sm text-stone-500">Processing: {title}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-red-600">Processing failed: {title}</p>
        <p className="text-xs text-stone-400">
          Check your API keys in Settings and try again.
        </p>
      </div>
    );
  }

  // status === "ready": show content preview
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-stone-900 mb-4 font-serif">
        {title}
      </h2>
      <div className="prose prose-stone prose-sm font-serif whitespace-pre-wrap">
        {content || <span className="text-stone-400">No content</span>}
      </div>
    </div>
  );
}

function RightPlaceholder() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
          Codebook
        </span>
        <p className="mt-2 text-xs text-stone-400">Codebook panel (Unit 8)</p>
      </div>
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
          Summary
        </span>
        <p className="mt-2 text-xs text-stone-400">Summary panel (Unit 13)</p>
      </div>
    </div>
  );
}
