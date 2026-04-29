/**
 * Type definitions for Phase 2 AI features.
 * These interfaces are complete so phase 2 implementation is a drop-in.
 */

export interface AiSuggestion {
  id: string;
  name: string;
  parentSuggestion: string | null;
  definition: string;
  evidence: string;
  sourceDocumentIds: string[];
  status: "pending" | "accepted" | "edited" | "dismissed";
}

export interface ProjectSummary {
  content: string;
  citations: { claim: string; documentIds: string[] }[];
  generatedAt: Date;
}
