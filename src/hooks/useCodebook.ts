"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import type { Code } from "@/types";

/**
 * Reactive query for all non-deleted codes in a project.
 * Returns codes organized for tree rendering (parents and children).
 */
export function useCodebook(projectId: string | null) {
  const codes = useLiveQuery(
    () =>
      projectId
        ? db.codes
            .where("projectId")
            .equals(projectId)
            .filter((c) => c.deletedAt === null)
            .toArray()
        : [],
    [projectId]
  );

  return codes ?? [];
}

/**
 * Builds a tree structure from a flat list of codes.
 * Top-level codes have parentId === null.
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
