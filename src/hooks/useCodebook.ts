"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import type { Code } from "@/types";

/**
 * Reactive query for all non-deleted codes in a project's codebook group.
 * When projects share a synced codebook, they all query by the same
 * codebookGroupId, so edits in one project appear in all linked projects.
 */
export function useCodebook(projectId: string | null) {
  const codes = useLiveQuery(
    async () => {
      if (!projectId) return [];

      // Get the project's codebookGroupId
      const project = await db.projects.get(projectId);
      if (!project) return [];

      const groupId = project.codebookGroupId ?? projectId;

      return db.codes
        .where("projectId")
        .equals(groupId)
        .filter((c) => c.deletedAt === null)
        .toArray();
    },
    [projectId]
  );

  return codes ?? [];
}

/**
 * Get the codebookGroupId for a project. Used when creating new codes
 * to ensure they go into the shared codebook.
 */
export function useCodebookGroupId(projectId: string | null) {
  return useLiveQuery(
    async () => {
      if (!projectId) return projectId;
      const project = await db.projects.get(projectId);
      return project?.codebookGroupId ?? projectId;
    },
    [projectId]
  );
}

/**
 * Builds a tree structure from a flat list of codes.
 */
export interface CodeTreeNode {
  code: Code;
  children: CodeTreeNode[];
}

export function buildCodeTree(codes: Code[]): CodeTreeNode[] {
  const childrenMap = new Map<string | null, Code[]>();

  for (const code of codes) {
    const parentKey = code.parentId ?? null;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(code);
  }

  function buildNodes(parentId: string | null): CodeTreeNode[] {
    const children = childrenMap.get(parentId) ?? [];
    return children.map((code) => ({
      code,
      children: buildNodes(code.id),
    }));
  }

  return buildNodes(null);
}
