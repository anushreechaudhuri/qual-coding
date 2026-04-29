/**
 * Parses codebook imports from CSV, JSON, or Markdown.
 * Returns a list of code entries for review before committing to the database.
 */

import { z } from "zod";

export interface ImportedCode {
  name: string;
  parent: string | null;
  definition: string;
  color: string;
}

const ImportedCodeSchema = z.object({
  name: z.string().min(1),
  parent: z.string().nullable().optional().default(null),
  definition: z.string().optional().default(""),
  color: z.string().optional().default("#78716c"),
});

/**
 * Parse CSV with columns: name, parent, definition, color.
 * First row is treated as header.
 */
export function parseCSV(text: string): ImportedCode[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const nameIdx = header.indexOf("name");
  const parentIdx = header.indexOf("parent");
  const defIdx = header.indexOf("definition");
  const colorIdx = header.indexOf("color");

  if (nameIdx === -1) {
    throw new Error("CSV must have a 'name' column");
  }

  const results: ImportedCode[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols[nameIdx]?.trim()) continue;

    const raw = {
      name: cols[nameIdx].trim(),
      parent: parentIdx >= 0 ? cols[parentIdx]?.trim() || null : null,
      definition: defIdx >= 0 ? cols[defIdx]?.trim() || "" : "",
      color: colorIdx >= 0 ? cols[colorIdx]?.trim() || "#78716c" : "#78716c",
    };

    const parsed = ImportedCodeSchema.safeParse(raw);
    if (parsed.success) {
      results.push(parsed.data as ImportedCode);
    }
  }

  return results;
}

/**
 * Parse JSON array of code objects.
 */
export function parseJSON(text: string): ImportedCode[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error("JSON must be an array of code objects");
  }

  return data
    .map((item) => ImportedCodeSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data as ImportedCode);
}

/**
 * Auto-detect format and parse.
 */
export function parseCodebook(text: string, fileName: string): ImportedCode[] {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "json") return parseJSON(text);
  if (ext === "csv") return parseCSV(text);

  // Try JSON first, fall back to CSV
  try {
    return parseJSON(text);
  } catch {
    return parseCSV(text);
  }
}

/**
 * Simple CSV line parser that handles quoted fields with commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
