/**
 * Stub for project auto-summary (Phase 2).
 *
 * When implemented, this will generate a living summary that updates
 * as documents are added. The summary cites which documents informed
 * each claim, and re-runs on demand or after N new primary docs.
 */

import type { ProjectSummary } from "@/types/ai";

export async function generateProjectSummary(
  _projectId: string
): Promise<ProjectSummary> {
  return {
    content: "",
    citations: [],
    generatedAt: new Date(),
  };
}
