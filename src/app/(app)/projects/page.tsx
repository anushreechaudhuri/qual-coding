"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectList } from "@/components/projects/ProjectList";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { useUiStore } from "@/lib/stores/uiStore";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";

export default function ProjectsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const currentProjectId = useUiStore((s) => s.currentProjectId);

  const currentProject = useLiveQuery(
    () => (currentProjectId ? db.projects.get(currentProjectId) : undefined),
    [currentProjectId]
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
        left={<ProjectList onCreateClick={() => setShowCreate(true)} />}
        center={
          currentProject ? (
            <CenterPlaceholder name={currentProject.name} />
          ) : (
            <EmptyCenter onCreateClick={() => setShowCreate(true)} />
          )
        }
        right={
          currentProject ? (
            <RightPlaceholder />
          ) : (
            <div />
          )
        }
      />

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} />
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
        <button
          onClick={onCreateClick}
          className="hover:text-stone-700"
        >
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

function CenterPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm text-stone-500">
        {name}
      </p>
      <p className="text-xs text-stone-400">
        Document viewer will appear here (Unit 7)
      </p>
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
        <p className="mt-2 text-xs text-stone-400">
          Codebook panel (Unit 8)
        </p>
      </div>
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
          Summary
        </span>
        <p className="mt-2 text-xs text-stone-400">
          Summary panel (Unit 13)
        </p>
      </div>
    </div>
  );
}
