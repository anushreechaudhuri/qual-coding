"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectList } from "@/components/projects/ProjectList";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { UploadModal } from "@/components/upload/UploadModal";
import { DocumentList } from "@/components/layout/DocumentList";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import { CodebookPanel } from "@/components/codebook/CodebookPanel";
import { ExportMenu } from "@/components/export/ExportMenu";
import { ProjectSummaryPanel } from "@/components/summary/ProjectSummary";
import { useUiStore } from "@/lib/stores/uiStore";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useProcessingQueue } from "@/hooks/useProcessingQueue";
import { useSync } from "@/hooks/useSync";
import { SyncIndicator } from "@/components/sync/SyncIndicator";

export default function ProjectsPage() {
  useProcessingQueue();
  useSync();
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
            projectId={currentProjectId}
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
            <DocumentViewer document={currentDocument} />
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
          currentProjectId ? (
            <div className="flex flex-col h-full">
              <CodebookPanel projectId={currentProjectId} />
              <ProjectSummaryPanel />
            </div>
          ) : (
            <div />
          )
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
  projectId,
  onCreateClick,
}: {
  projectName: string | null;
  projectId: string | null;
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
        {projectId && projectName && (
          <ExportMenu projectId={projectId} projectName={projectName} />
        )}
        <Link href="/settings" className="hover:text-stone-700">
          Settings
        </Link>
        <AuthButton />
        <SyncIndicator />
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

function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: "/", redirect: true })}
        className="hover:text-stone-700"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/projects" })}
      className="hover:text-stone-700"
    >
      Sign in
    </button>
  );
}

