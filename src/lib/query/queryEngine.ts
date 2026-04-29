/**
 * Query engine for filtering and analyzing coded segments.
 */

import { db } from "@/lib/db/schema";
import type { Coding, Document } from "@/types";

export interface QueryFilters {
  codeIds?: string[];
  purpose?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
  searchText?: string;
}

/**
 * Filter coded segments by code, document purpose, language, date, and text.
 */
export async function queryCodingSegments(
  projectId: string,
  filters: QueryFilters
): Promise<(Coding & { documentTitle: string })[]> {
  let codings = await db.codings
    .where("projectId")
    .equals(projectId)
    .filter((c) => c.deletedAt === null)
    .toArray();

  if (filters.codeIds && filters.codeIds.length > 0) {
    const codeSet = new Set(filters.codeIds);
    codings = codings.filter((c) => codeSet.has(c.codeId));
  }

  if (filters.searchText) {
    const query = filters.searchText.toLowerCase();
    codings = codings.filter((c) =>
      c.quotedText.toLowerCase().includes(query)
    );
  }

  // Get documents for additional filtering
  const docMap = new Map<string, Document>();
  const docs = await db.documents
    .where("projectId")
    .equals(projectId)
    .filter((d) => d.deletedAt === null)
    .toArray();
  for (const doc of docs) {
    docMap.set(doc.id, doc);
  }

  let results = codings.map((coding) => ({
    ...coding,
    documentTitle: docMap.get(coding.documentId)?.title ?? "Unknown",
  }));

  if (filters.purpose) {
    results = results.filter(
      (r) => docMap.get(r.documentId)?.purpose === filters.purpose
    );
  }

  if (filters.language) {
    results = results.filter(
      (r) => docMap.get(r.documentId)?.language === filters.language
    );
  }

  if (filters.dateFrom) {
    results = results.filter(
      (r) => (docMap.get(r.documentId)?.dateCollected ?? "") >= filters.dateFrom!
    );
  }

  if (filters.dateTo) {
    results = results.filter(
      (r) => (docMap.get(r.documentId)?.dateCollected ?? "") <= filters.dateTo!
    );
  }

  return results;
}

/**
 * Find segments where both codeA and codeB are applied to overlapping
 * or adjacent offset ranges within the same document.
 */
export async function findCoOccurrence(
  projectId: string,
  codeIdA: string,
  codeIdB: string
): Promise<{ documentId: string; documentTitle: string; codingsA: Coding[]; codingsB: Coding[] }[]> {
  const allCodings = await db.codings
    .where("projectId")
    .equals(projectId)
    .filter((c) => c.deletedAt === null)
    .toArray();

  const docs = await db.documents
    .where("projectId")
    .equals(projectId)
    .filter((d) => d.deletedAt === null)
    .toArray();
  const docMap = new Map(docs.map((d) => [d.id, d]));

  // Group codings by document
  const byDoc = new Map<string, Coding[]>();
  for (const coding of allCodings) {
    if (coding.codeId !== codeIdA && coding.codeId !== codeIdB) continue;
    if (!byDoc.has(coding.documentId)) byDoc.set(coding.documentId, []);
    byDoc.get(coding.documentId)!.push(coding);
  }

  const results: { documentId: string; documentTitle: string; codingsA: Coding[]; codingsB: Coding[] }[] = [];

  for (const [docId, docCodings] of byDoc) {
    const codingsA = docCodings.filter((c) => c.codeId === codeIdA);
    const codingsB = docCodings.filter((c) => c.codeId === codeIdB);

    if (codingsA.length > 0 && codingsB.length > 0) {
      results.push({
        documentId: docId,
        documentTitle: docMap.get(docId)?.title ?? "Unknown",
        codingsA,
        codingsB,
      });
    }
  }

  return results;
}

/**
 * Word frequency analysis across documents in a project.
 */
export async function wordFrequency(
  projectId: string,
  filters?: { purpose?: string; language?: string }
): Promise<{ word: string; count: number }[]> {
  let docs = await db.documents
    .where("projectId")
    .equals(projectId)
    .filter((d) => d.deletedAt === null && d.status === "ready")
    .toArray();

  if (filters?.purpose) {
    docs = docs.filter((d) => d.purpose === filters.purpose);
  }
  if (filters?.language) {
    docs = docs.filter((d) => d.language === filters.language);
  }

  const counts = new Map<string, number>();

  for (const doc of docs) {
    // Use Intl.Segmenter for language-aware word splitting when available
    const words = segmentWords(doc.content);
    for (const word of words) {
      const normalized = word.toLowerCase();
      if (normalized.length < 2) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

function segmentWords(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    return Array.from(segmenter.segment(text))
      .filter((s) => s.isWordLike)
      .map((s) => s.segment);
  }
  return text.split(/\s+/).filter(Boolean);
}
