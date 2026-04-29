/**
 * Processing time and cost estimates for document ingestion.
 *
 * Based on:
 * - Gemini 2.5 Flash: $0.15/1M input tokens, $0.60/1M output tokens
 *   Audio = 32 tokens/sec. ~1MB ≈ 2 min of audio at typical compression.
 * - Reducto: ~$0.01-0.05/page, ~5-10 sec/page
 *   ~1MB ≈ 5-10 pages for a typical PDF
 */

export interface ProcessingEstimate {
  timeRange: string;
  costRange: string;
  details: string;
}

export function estimateProcessing(
  fileSize: number,
  mimeType: string
): ProcessingEstimate {
  const sizeMB = fileSize / (1024 * 1024);

  if (mimeType.startsWith("audio/")) {
    return estimateAudio(sizeMB);
  }

  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    mimeType.includes("document") ||
    mimeType.includes("sheet")
  ) {
    return estimateDocument(sizeMB, mimeType);
  }

  return {
    timeRange: "instant",
    costRange: "free",
    details: "Text files are stored directly, no API call needed.",
  };
}

function estimateAudio(sizeMB: number): ProcessingEstimate {
  // Rough: 1MB ≈ 1-2 min of audio at typical m4a/mp3 compression
  const durationMinLow = sizeMB * 1;
  const durationMinHigh = sizeMB * 2.5;

  // Gemini audio tokens: 32 tokens/sec
  const tokensLow = durationMinLow * 60 * 32;
  const tokensHigh = durationMinHigh * 60 * 32;

  // Input cost: $0.15/1M tokens
  const inputCostLow = (tokensLow / 1_000_000) * 0.15;
  const inputCostHigh = (tokensHigh / 1_000_000) * 0.15;

  // Output cost: assume transcript is ~10% of input tokens, $0.60/1M
  const outputCostLow = (tokensLow * 0.1 / 1_000_000) * 0.60;
  const outputCostHigh = (tokensHigh * 0.1 / 1_000_000) * 0.60;

  const totalLow = inputCostLow + outputCostLow;
  const totalHigh = inputCostHigh + outputCostHigh;

  // Processing time: upload (sizeMB/2 seconds) + transcription (1-3x duration)
  const uploadSec = sizeMB / 2;
  const transcribeMinLow = durationMinLow * 0.5;
  const transcribeMinHigh = durationMinHigh * 1.5;
  const totalTimeLow = uploadSec / 60 + transcribeMinLow;
  const totalTimeHigh = uploadSec / 60 + transcribeMinHigh;

  return {
    timeRange: `${formatTime(totalTimeLow)} – ${formatTime(totalTimeHigh)}`,
    costRange: `$${totalLow.toFixed(3)} – $${totalHigh.toFixed(3)}`,
    details: `~${Math.round(durationMinLow)}–${Math.round(durationMinHigh)} min of audio. Gemini 2.5 Flash transcription with diarization and translation.`,
  };
}

function estimateDocument(sizeMB: number, mimeType: string): ProcessingEstimate {
  const isImage = mimeType.startsWith("image/");

  if (isImage) {
    return {
      timeRange: "5–15 sec",
      costRange: "$0.01 – $0.03",
      details: "Single image OCR via Reducto with agentic text enhancement.",
    };
  }

  // PDF/document: estimate pages from file size
  const pagesLow = Math.max(1, Math.round(sizeMB * 3));
  const pagesHigh = Math.max(1, Math.round(sizeMB * 10));

  const timeLow = pagesLow * 3;
  const timeHigh = pagesHigh * 8;

  // Reducto: ~$0.01-0.03 per page
  const costLow = pagesLow * 0.01;
  const costHigh = pagesHigh * 0.03;

  return {
    timeRange: `${formatTime(timeLow / 60)} – ${formatTime(timeHigh / 60)}`,
    costRange: `$${costLow.toFixed(2)} – $${costHigh.toFixed(2)}`,
    details: `~${pagesLow}–${pagesHigh} pages estimated. Reducto parsing with OCR.`,
  };
}

function formatTime(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}
