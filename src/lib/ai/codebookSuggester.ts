/**
 * Stub for AI-assisted codebook suggestions (Phase 2).
 *
 * When implemented, this will analyze primary documents and propose
 * new codes with evidence and source references. Suggestions appear
 * in a review queue where users can accept, edit, or dismiss them.
 */

import type { AiSuggestion } from "@/types/ai";

export async function generateCodeSuggestions(
  _projectId: string
): Promise<AiSuggestion[]> {
  return [];
}
