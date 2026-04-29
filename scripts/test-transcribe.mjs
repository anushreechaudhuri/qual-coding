/**
 * Standalone test: upload an audio file to Gemini and transcribe it.
 * Bypasses the app entirely to isolate API issues.
 *
 * Usage: node scripts/test-transcribe.mjs <path-to-audio-file>
 */

import { readFileSync } from "fs";
import { basename } from "path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/test-transcribe.mjs <audio-file-path>");
  process.exit(1);
}

// Read API key from .env
const envContent = readFileSync(".env", "utf-8");
const apiKey = envContent.match(/GEMINI_API_KEY="([^"]+)"/)?.[1];
if (!apiKey) {
  console.error("No GEMINI_API_KEY found in .env");
  process.exit(1);
}

const fileBuffer = readFileSync(filePath);
const fileSizeMB = fileBuffer.length / (1024 * 1024);
console.log(`File: ${basename(filePath)}, Size: ${fileSizeMB.toFixed(1)}MB`);

// Detect mime type from extension
const ext = filePath.split(".").pop().toLowerCase();
const mimeTypes = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4",
  ogg: "audio/ogg", flac: "audio/flac", webm: "audio/webm",
};
const mimeType = mimeTypes[ext] ?? "audio/mpeg";
console.log(`MIME type: ${mimeType}`);

// Step 1: Upload via Files API
console.log("\n--- Step 1: Upload to Gemini Files API ---");
const startTime = Date.now();

const startRes = await fetch(
  `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
  {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": fileBuffer.length.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { displayName: basename(filePath) } }),
  }
);

if (!startRes.ok) {
  console.error("Upload start failed:", startRes.status, await startRes.text());
  process.exit(1);
}

const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
console.log(`Upload URL obtained in ${Date.now() - startTime}ms`);

const uploadRes = await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    "X-Goog-Upload-Command": "upload, finalize",
    "X-Goog-Upload-Offset": "0",
    "Content-Length": fileBuffer.length.toString(),
  },
  body: fileBuffer,
});

if (!uploadRes.ok) {
  console.error("Upload failed:", uploadRes.status, await uploadRes.text());
  process.exit(1);
}

const uploadResult = await uploadRes.json();
const fileUri = uploadResult.file?.uri;
const fileName = uploadResult.file?.name;
console.log(`Upload complete in ${Date.now() - startTime}ms`);
console.log(`File URI: ${fileUri}`);
console.log(`File state: ${uploadResult.file?.state}`);

// Step 2: Wait for processing
if (uploadResult.file?.state === "PROCESSING") {
  console.log("\n--- Waiting for file processing ---");
  let state = "PROCESSING";
  while (state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 3000));
    const checkRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );
    const checkResult = await checkRes.json();
    state = checkResult.state;
    console.log(`  State: ${state} (${((Date.now() - startTime) / 1000).toFixed(0)}s elapsed)`);
    if (state === "FAILED") {
      console.error("File processing failed:", JSON.stringify(checkResult));
      process.exit(1);
    }
  }
}

// Step 3: Transcribe
console.log("\n--- Step 2: Transcribe ---");
const transcribeStart = Date.now();

const prompt = `Transcribe this audio. For each speaker turn, provide: speaker label, timestamp (MM:SS), original language content, language code, and English translation. Return JSON with a "segments" array.`;

const transcribeRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { fileData: { mimeType, fileUri } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            segments: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  speaker: { type: "STRING" },
                  timestamp: { type: "STRING" },
                  content: { type: "STRING" },
                  language: { type: "STRING" },
                  translation: { type: "STRING" },
                },
                required: ["speaker", "timestamp", "content", "language", "translation"],
              },
            },
          },
          required: ["segments"],
        },
      },
    }),
  }
);

console.log(`Transcribe response: ${transcribeRes.status} in ${((Date.now() - transcribeStart) / 1000).toFixed(0)}s`);

if (!transcribeRes.ok) {
  const errText = await transcribeRes.text();
  console.error("Transcribe error:", errText.slice(0, 500));
  process.exit(1);
}

const result = await transcribeRes.json();
const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

if (!text) {
  console.error("No text in response:", JSON.stringify(result).slice(0, 500));
  // Check for safety/finish reasons
  console.error("Finish reason:", result.candidates?.[0]?.finishReason);
  console.error("Safety ratings:", JSON.stringify(result.candidates?.[0]?.safetyRatings));
  process.exit(1);
}

const parsed = JSON.parse(text);
console.log(`\n--- Success: ${parsed.segments?.length ?? 0} segments ---`);
console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);

// Print first 3 segments as preview
for (const seg of (parsed.segments ?? []).slice(0, 3)) {
  console.log(`\n${seg.speaker} · ${seg.timestamp}`);
  console.log(`  ${seg.content.slice(0, 100)}`);
  if (seg.translation !== seg.content) {
    console.log(`  → ${seg.translation.slice(0, 100)}`);
  }
}

if (parsed.segments?.length > 3) {
  console.log(`\n... and ${parsed.segments.length - 3} more segments`);
}
