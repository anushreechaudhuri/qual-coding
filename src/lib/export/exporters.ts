/**
 * Export formatters for coded segments, codebook, project data, and memos.
 */

import { db } from "@/lib/db/schema";
import type { Code, Coding, Memo, Document } from "@/types";

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export coded segments as CSV.
 */
export async function exportCodedSegmentsCSV(projectId: string): Promise<string> {
  const [codings, codes, docs, memos] = await Promise.all([
    db.codings.where("projectId").equals(projectId).filter((c) => c.deletedAt === null).toArray(),
    db.codes.where("projectId").equals(projectId).filter((c) => c.deletedAt === null).toArray(),
    db.documents.where("projectId").equals(projectId).filter((d) => d.deletedAt === null).toArray(),
    db.memos.where("projectId").equals(projectId).filter((m) => m.deletedAt === null).toArray(),
  ]);

  const codeMap = new Map(codes.map((c) => [c.id, c]));
  const docMap = new Map(docs.map((d) => [d.id, d]));
  const memoMap = new Map<string, Memo>();
  for (const m of memos) {
    if (m.targetType === "quotation") memoMap.set(m.targetId, m);
  }

  const header = "Document,Code,Parent Code,Quoted Text,Start,End,Purpose,Language,Date Collected,Memo";
  const rows = codings.map((coding) => {
    const code = codeMap.get(coding.codeId);
    const parentCode = code?.parentId ? codeMap.get(code.parentId) : null;
    const doc = docMap.get(coding.documentId);
    const memo = memoMap.get(coding.id);

    return [
      csvEscape(doc?.title ?? ""),
      csvEscape(code?.name ?? ""),
      csvEscape(parentCode?.name ?? ""),
      csvEscape(coding.quotedText),
      coding.startOffset,
      coding.endOffset,
      doc?.purpose ?? "",
      doc?.language ?? "",
      doc?.dateCollected ?? "",
      csvEscape(memo?.content ?? ""),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Export codebook as CSV.
 */
export async function exportCodebookCSV(projectId: string): Promise<string> {
  const codes = await db.codes
    .where("projectId").equals(projectId)
    .filter((c) => c.deletedAt === null)
    .toArray();

  const codeMap = new Map(codes.map((c) => [c.id, c]));
  const codingCounts = new Map<string, number>();

  const codings = await db.codings
    .where("projectId").equals(projectId)
    .filter((c) => c.deletedAt === null)
    .toArray();

  for (const coding of codings) {
    codingCounts.set(coding.codeId, (codingCounts.get(coding.codeId) ?? 0) + 1);
  }

  const header = "Name,Parent,Definition,Color,Provenance,Segment Count";
  const rows = codes.map((code) => {
    const parent = code.parentId ? codeMap.get(code.parentId) : null;
    return [
      csvEscape(code.name),
      csvEscape(parent?.name ?? ""),
      csvEscape(code.definition),
      code.color,
      code.provenance,
      codingCounts.get(code.id) ?? 0,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Export full project as JSON.
 */
export async function exportProjectJSON(projectId: string): Promise<string> {
  const [project, docs, codes, codings, memos] = await Promise.all([
    db.projects.get(projectId),
    db.documents.where("projectId").equals(projectId).filter((d) => d.deletedAt === null).toArray(),
    db.codes.where("projectId").equals(projectId).filter((c) => c.deletedAt === null).toArray(),
    db.codings.where("projectId").equals(projectId).filter((c) => c.deletedAt === null).toArray(),
    db.memos.where("projectId").equals(projectId).filter((m) => m.deletedAt === null).toArray(),
  ]);

  // Omit binary content from export
  const docsWithoutBinary = docs.map(({ binaryAssetId, ...rest }) => rest);

  return JSON.stringify(
    { project, documents: docsWithoutBinary, codes, codings, memos },
    null,
    2
  );
}

/**
 * Export memos as Markdown, grouped by target type.
 */
export async function exportMemosMarkdown(projectId: string): Promise<string> {
  const [memos, docs, codes] = await Promise.all([
    db.memos.where("projectId").equals(projectId).filter((m) => m.deletedAt === null).toArray(),
    db.documents.where("projectId").equals(projectId).filter((d) => d.deletedAt === null).toArray(),
    db.codes.where("projectId").equals(projectId).filter((c) => c.deletedAt === null).toArray(),
  ]);

  const docMap = new Map(docs.map((d) => [d.id, d]));
  const codeMap = new Map(codes.map((c) => [c.id, c]));

  const groups: Record<string, Memo[]> = {};
  for (const memo of memos) {
    if (!groups[memo.targetType]) groups[memo.targetType] = [];
    groups[memo.targetType].push(memo);
  }

  const sections: string[] = [];

  for (const [type, typeMemos] of Object.entries(groups)) {
    sections.push(`# ${type.charAt(0).toUpperCase() + type.slice(1)} Memos\n`);

    for (const memo of typeMemos) {
      let label = memo.targetId;
      if (type === "document") label = docMap.get(memo.targetId)?.title ?? memo.targetId;
      if (type === "code") label = codeMap.get(memo.targetId)?.name ?? memo.targetId;

      sections.push(`## ${label}\n`);
      sections.push(memo.content);
      sections.push(`\n*${memo.updatedAt.toLocaleDateString()}*\n`);
    }
  }

  return sections.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
