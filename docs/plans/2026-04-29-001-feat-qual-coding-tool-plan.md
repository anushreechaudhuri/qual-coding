---
title: "feat: Build qualitative coding tool (phase 1)"
type: feat
status: active
date: 2026-04-29
origin: docs/brainstorms/2026-04-29-qual-coding-tool-requirements.md
deepened: 2026-04-29
---

# feat: Build qualitative coding tool (phase 1)

## Overview

Greenfield build of a local-first qualitative coding tool for multilingual fieldwork. Phase 1 delivers: Google OAuth, IndexedDB storage with Drive sync, document ingestion (Reducto for documents, Gemini for audio), manual coding with bilingual span linking, codebook management, memos, query/filtering, and export. AI-assisted codebook and auto-summary are stubbed with typed interfaces.

## Problem Frame

Qualitative researchers doing fieldwork in multilingual contexts (Bangla/English, Indonesian) rely on expensive desktop tools (Atlas.ti, NVivo) or ad-hoc spreadsheets. Both fail at multilingual audio, scanned documents, and offline use in areas with unreliable internet. This tool is a free, open-source alternative that handles the hardest parts: transcription with diarization, document parsing, and structured coding across languages. (see origin: docs/brainstorms/2026-04-29-qual-coding-tool-requirements.md)

## Requirements Trace

- R1. Google OAuth with Drive access
- R2. IndexedDB as working store, Drive as canonical backing
- R3. Full offline capability with queued sync
- R4. Conflict resolution for sync
- R5. Implicit workspace (project list on sign-in)
- R6. Project CRUD
- R7. Upload modal with purpose/language/date/notes
- R8. Audio transcription via Gemini with diarization and translation
- R9. Document parsing via Reducto
- R10. Plain text ingestion
- R11. Canonical markdown output with metadata
- R12-R16. Coding engine (span selection, hierarchical codes, quick-apply, quotation memos, bilingual span linking)
- R17-R18. Codebook management (inline editing, import)
- R19. Memos (project/document/code/quotation-level)
- R20-R23. Query and retrieval (filtering, co-occurrence, quotation view, word frequency)
- R24-R27. Export (CSV, codebook, JSON, markdown)
- R28. BYO API key settings
- R29-R30. Phase 2 stubs (AI codebook, auto-summary)

## Scope Boundaries

- No real-time multi-user collaboration
- No visualizations (network views, code maps)
- No inter-coder reliability
- No mobile-specific UI
- No server-side database or API key storage
- Phase 2 features (R29, R30) are typed interfaces only

## Context & Research

### Technology Stack

- Next.js 14+ (App Router), React 18+, TypeScript, Tailwind CSS, pnpm
- **Dexie.js** for IndexedDB (reactive `useLiveQuery` hook, cross-tab sync via BroadcastChannel, schema migrations, compound indexes)
- **Zustand** for ephemeral UI state only (current selection, panel visibility, modal state). Persisted data lives in Dexie, not Zustand.
- **Auth.js v5** for Google OAuth (single `auth()` function for server components and middleware)
- **wavesurfer.js** for audio waveform visualization and playback
- **Zod** for runtime schema validation (API responses, codebook imports)
- **reductoai** npm package for Reducto API
- **@google/generative-ai** for Gemini API
- Google Drive REST API v3 with `appDataFolder` scope

### External API Integration Patterns

**Reducto (documents):** POST `/parse` returns markdown-formatted content blocks. Use `extraction_mode: "ocr"` for scanned/handwritten documents. `settings.return_images` for figure extraction. Node SDK: `import Reducto from 'reductoai'`. Upload files first via `/upload`, then parse by `file_id`.

**Gemini (audio):** Upload via Files API for audio >20MB. Call `generateContent` with a prompt requesting diarized transcription + translation. Use `response_mime_type: "application/json"` with `response_schema` to enforce structured segments: `{ speaker, timestamp, content, language, translation }`. Diarization is prompt-based, not a native API flag. 32 tokens/sec of audio. Bangla transcription quality validated by user (near-perfect results with 20MB chunks). Indonesian needs similar validation. Diarization accuracy (speaker separation) is the remaining variable to test.

**API route proxies:** Client sends BYO API key in request header (e.g., `X-Reducto-Key`). Next.js API route extracts key, calls upstream API, returns response. Keys never stored server-side. Proxies handle CORS, normalize errors, and allow future logging.

### Sync Architecture

**IndexedDB (Dexie)** is the working store. Every entity has `updatedAt` and `_dirty` fields. On local writes, `_dirty` is set true.

**Google Drive `appDataFolder`** is the canonical store. Uses a narrow OAuth scope (`drive.appdata`), data is hidden from the user's Drive UI. Structure:
- `manifest.json` with file IDs and version timestamps
- Per-project metadata JSON files (e.g., `documents-meta-{projectId}.json`) store entity records without large text content
- Document content stored as individual Drive text files (one per document) to avoid hitting appDataFolder per-file size limits (~10-25MB)
- Binary files (uploaded audio, PDFs) stored as individual Drive files, referenced by Drive file ID in document metadata

**Sync triggers:** `online` event, `visibilitychange` (app focus), periodic interval (60s while online).

**Conflict resolution:** Last-write-wins with field-level merge. Each record stores a `_lastSyncedSnapshot` (a frozen copy of the record as it was at last successful sync). On conflict, the resolver diffs local-current vs. snapshot and remote-current vs. snapshot to determine which fields each side changed. Different fields merge cleanly; same field modified on both sides resolves to newer `updatedAt`. Single-user app makes this acceptable.

**Deletion propagation:** All entities have a `deletedAt` field (soft delete). The sync engine treats non-null `deletedAt` as a deletion to propagate to Drive. Hard deletion happens after Drive confirms the tombstone. This prevents deleted records from reappearing after sync.

**Multi-tab:** Dexie handles cross-tab data propagation via its internal `storagemutated` event system. Web Locks API (`navigator.locks.request("drive-sync")`) ensures only one tab runs the sync loop.

### Text Selection and Coding

Use the native `Selection` API (`window.getSelection()`). Serialize selections as character offsets relative to a stable container element. Store codings as `{ startOffset, endOffset, codeIds, isTranslation, linkedCodingId }`. Render highlights by splitting text at offset boundaries at render time, not by injecting DOM nodes.

**Bilingual span linking:** Audio documents produce paired content (original segments + translation). Each segment has an index. When a user codes a span in the original text, the system computes the corresponding segment(s) and creates a linked coding on the translation (and vice versa). Segment-level linking (which segments are covered) rather than character-level alignment across languages.

## Key Technical Decisions

- **Dexie.js over Zustand for persisted state**: Dexie's `useLiveQuery` provides reactive queries directly from IndexedDB, eliminating the need for a parallel state management layer for persisted data. Zustand handles only ephemeral UI state (modal visibility, current selection).
- **Google Drive `appDataFolder` over visible Drive folders**: Narrower OAuth scope (`drive.appdata` vs `drive`), data hidden from user's Drive, no risk of user accidentally deleting app data.
- **Last-write-wins with field-level merge**: CRDTs and OT are unnecessary for a single-user app. Field-level merge handles the realistic conflict scenario (editing on two devices before sync) simply.
- **API route proxies over direct client calls**: Avoids CORS issues, normalizes error handling, enables future logging. Keys transit over HTTPS (browser -> Vercel serverless -> upstream API), acceptable for the use case.
- **Segment-level bilingual linking over character-level alignment**: Cross-language character alignment is fragile and expensive. Linking at the segment level (which timestamped segments does the selection cover) is robust and matches the Gemini output structure.
- **Zod for structured API validation**: TypeScript equivalent of Pydantic. Validates Gemini and Reducto responses at runtime, catches schema drift early.

## Open Questions

### Resolved During Planning

- **Conflict resolution strategy (R3, R4):** Last-write-wins with field-level merge. Per-record `updatedAt` timestamps. Acceptable for single-user.
- **Drive file structure (R2):** `appDataFolder` with per-project entity JSON files plus individual Drive files for binaries. Manifest for incremental sync.
- **Gemini transcription (R8):** Bangla transcription quality validated by user. Structured JSON response schema works for segments with timestamps and translation.
- **Reducto integration (R9):** Node SDK, POST `/parse` for markdown, OCR mode for scans. Straightforward.
- **Bilingual span linking (R16):** Segment-level linking via shared segment index. Original and translation each store codings independently with `linkedCodingId` cross-references.
- **API key validation (R28):** Lazy validation on first use. No unnecessary test calls on entry.
- **Audio playback (R8):** wavesurfer.js for waveform rendering. Timestamped segments from Gemini map to wavesurfer regions.

### Deferred to Implementation

- Gemini diarization (speaker separation) accuracy validation. Transcription quality is validated for Bangla, but prompt-based diarization is unvalidated for all languages. Test against a known multi-speaker recording early in Unit 6.
- Exact Gemini prompt wording for optimal diarization accuracy across Bangla, Hindi, and Indonesian
- wavesurfer.js region/marker API details for segment-to-playback linking
- Whether Reducto's Node SDK works cleanly in Next.js API routes or needs raw fetch (if SDK fails, fall back to raw HTTP fetch against Reducto REST API)
- Optimal chunk size for Gemini audio processing (if interviews exceed practical limits)
- Character offset stability when documents are re-processed (re-ingestion invalidates existing codings, need a strategy)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Shell                     │
│  ┌──────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Document │  │  Document Viewer │  │   Codebook +  │  │
│  │   List   │  │  (markdown +     │  │   Summary     │  │
│  │ (left)   │  │   audio player)  │  │   (right)     │  │
│  └──────────┘  └──────────────────┘  └───────────────┘  │
│         │               │                    │           │
│         └───────────────┼────────────────────┘           │
│                         │                                │
│              ┌──────────▼──────────┐                     │
│              │   Dexie.js (IDB)   │                      │
│              │   useLiveQuery()   │                      │
│              └──────────┬─────────┘                      │
│                         │ _dirty records                 │
│              ┌──────────▼──────────┐                     │
│              │   Sync Engine      │                      │
│              │   (Web Locks API)  │                      │
│              └──────────┬─────────┘                      │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  Google Drive API     │
              │  (appDataFolder)      │
              └───────────────────────┘

Ingestion Pipeline:
  Upload → Detect file type → Route:
    audio     → API route → Gemini (transcribe + diarize + translate)
    pdf/scan  → API route → Reducto (parse to markdown)
    text      → Direct ingest (no API call)
  → Store canonical markdown + metadata in Dexie
  → Mark _dirty for Drive sync
```

```
Data Model (Dexie tables):

  All entities share: createdAt, updatedAt, deletedAt, _dirty, _lastSyncedSnapshot

  projects:      id, name
  documents:     id, projectId, title, purpose, language, dateCollected,
                 notes, fileType, status, content, translationContent,
                 segments[], metadata{}, driveFileId, binaryAssetId
  codes:         id, projectId, name, parentId, definition, color, provenance
  codings:       id, projectId, documentId, codeId, startOffset, endOffset,
                 isTranslation, linkedCodingId, quotedText
  memos:         id, projectId, targetType, targetId, content
  binaryAssets:  id, documentId, blob, mimeType, driveFileId
  syncMeta:      entityType, lastSyncedAt, driveFileId
```

## Implementation Units

### Phase A: Foundation

- [ ] **Unit 1: Project scaffolding and data model**

**Goal:** Initialize the Next.js project, install dependencies, define the Dexie database schema, TypeScript types, and project directory structure.

**Requirements:** R2, R5, R6 (foundation for all)

**Dependencies:** None

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `postcss.config.js`
- Create: `src/types/index.ts` (all entity types including shared `SyncableEntity` base)
- Create: `src/types/api.ts` (shared API error response type: `{ error, code, retryable }`)
- Create: `src/lib/db/schema.ts` (Dexie database class with table definitions and migrations)
- Create: `src/lib/db/operations.ts` (CRUD helpers for each table, all writes set `_dirty: true`)
- Create: `src/lib/stores/uiStore.ts` (Zustand store for ephemeral UI state)
- Create: `docs/ARCHITECTURE.md` (plain-language architecture overview)
- Create: `.gitignore`
- Test: `src/lib/db/__tests__/operations.test.ts`

**Approach:**
- Use `pnpm create next-app` with App Router, TypeScript, Tailwind, src/ directory
- Install: `dexie dexie-react-hooks zustand zod wavesurfer.js next-auth@5 @auth/core`
- Define Dexie database class with versioned schema matching the data model diagram above
- All entity types extend a `SyncableEntity` base with: `createdAt`, `updatedAt`, `deletedAt` (nullable, for tombstone-based sync), `_dirty: boolean`, `_lastSyncedSnapshot` (frozen copy of record at last sync, used for field-level conflict resolution)
- `binaryAssets` table stores uploaded file Blobs (audio, PDFs) with `driveFileId` for sync. Kept separate from documents to avoid loading large blobs when querying metadata.
- Zustand store (`uiStore.ts`) defines explicit slices: `currentProjectId`, `currentDocumentId`, `selectedCodingId`, `panelVisibility`, `selectionRange`, `modalState`. This prevents ad-hoc store creation across units.
- Shared `ApiErrorResponse` type used by all API route proxies: `{ error: string, code: 'auth' | 'rate_limit' | 'upstream_error' | 'validation', retryable: boolean }`
- Write ARCHITECTURE.md in plain language explaining the local-first approach, sync strategy, and file structure

**Patterns to follow:**
- Dexie schema declaration pattern from dexie.org docs
- Next.js App Router project structure conventions

**Test scenarios:**
- Happy path: create a project via `db.projects.add()`, read it back, verify all fields including `_dirty: true`
- Happy path: create a document with all metadata fields, verify compound index on `[projectId+purpose]`
- Happy path: soft-delete a record (set `deletedAt`), verify it is excluded from normal queries but retrievable for sync
- Edge case: Dexie migration from version 1 to version 2 preserves existing data
- Edge case: `_dirty` defaults to `true` on create, `false` after explicit sync marking
- Edge case: `_lastSyncedSnapshot` is null on new records, set to record copy after sync

**Verification:**
- `pnpm dev` starts without errors
- Dexie database initializes in browser DevTools > Application > IndexedDB
- All TypeScript types compile without errors

---

- [ ] **Unit 2: Google OAuth and settings page**

**Goal:** Implement Google sign-in with Drive scope and a settings page for BYO API keys.

**Requirements:** R1, R28

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts` (Auth.js config)
- Create: `src/app/page.tsx` (landing/sign-in page)
- Create: `src/app/(app)/layout.tsx` (authenticated layout with auth guard)
- Create: `src/app/(app)/settings/page.tsx` (API key settings)
- Create: `src/components/auth/SignInButton.tsx`
- Create: `src/components/settings/ApiKeyForm.tsx`
- Create: `src/lib/settings.ts` (read/write keys from localStorage)
- Create: `src/hooks/useApiKeys.ts`
- Test: `src/lib/__tests__/settings.test.ts`

**Approach:**
- Auth.js v5 with Google provider. Request scopes: `openid email profile https://www.googleapis.com/auth/drive.appdata`. Configure authorization params: `access_type: 'offline'` and `prompt: 'consent'` to ensure Google issues a refresh token (without these, only a short-lived access_token is returned).
- **OAuth token flow to client:** Auth.js v5 does not expose access tokens to the client by default. Configure a `jwt` callback that persists `account.access_token` and `account.refresh_token` into the JWT, and a `session` callback that adds `token.access_token` to the session object. This makes the Drive access token available via `useSession()` on the client for the sync engine (Unit 12). Handle token refresh in the `jwt` callback using the refresh token. Requires TypeScript module augmentation: `declare module 'next-auth'` to extend the Session and JWT interfaces with `access_token`, `refresh_token`, and `expires_at` fields.
- Settings page: four text inputs (Gemini, Reducto, Anthropic, OpenAI keys). Save to localStorage via a typed helper. Keys never sent to our server.
- Lazy key validation: keys are tested on first actual API use, not on entry
- Auth guard in `(app)/layout.tsx` redirects unauthenticated users to the landing page

**Patterns to follow:**
- Auth.js v5 App Router configuration from auth-js.dev docs

**Test scenarios:**
- Happy path: save an API key via settings form, read it back from localStorage, verify value matches
- Happy path: clear an API key, verify it returns null
- Edge case: settings page renders with empty fields when no keys are stored
- Error path: localStorage is full or unavailable (e.g., private browsing), surface a clear error message

**Verification:**
- Google sign-in flow completes and redirects to authenticated layout
- Settings page saves and loads API keys correctly
- Unauthenticated access to `/projects` redirects to sign-in

---

- [ ] **Unit 3: Layout shell and project CRUD**

**Goal:** Build the three-panel layout and project list with create/rename/delete.

**Requirements:** R5, R6

**Dependencies:** Unit 2

**Files:**
- Create: `src/components/layout/AppShell.tsx` (three-panel layout with `'use client'`)
- Create: `src/components/layout/LeftPanel.tsx`
- Create: `src/components/layout/CenterPanel.tsx`
- Create: `src/components/layout/RightPanel.tsx`
- Create: `src/app/(app)/projects/page.tsx` (project list)
- Create: `src/app/(app)/projects/[projectId]/page.tsx` (project view)
- Create: `src/components/projects/ProjectList.tsx`
- Create: `src/components/projects/CreateProjectModal.tsx`
- Create: `src/hooks/useProjects.ts` (Dexie `useLiveQuery` for project list)
- Test: `src/components/projects/__tests__/ProjectList.test.ts`

**Approach:**
- `AppShell` is the `'use client'` boundary. Three resizable panels using CSS Grid.
- Left panel: document list (grouped by purpose). Center: document viewer. Right: codebook + summary.
- Design: clean, minimal, dense. Linear/Notion adjacent. Use a serif font (e.g., Source Serif 4) for document reading panes, sans-serif (Inter or system) for UI chrome.
- `useProjects` hook wraps `useLiveQuery(() => db.projects.toArray())` for reactive project list
- Project CRUD operations go through `src/lib/db/operations.ts`, which sets `_dirty: true`

**Patterns to follow:**
- Mockup: three-panel layout with document list left, document center, codebook right
- Tailwind CSS Grid for panel layout

**Test scenarios:**
- Happy path: create a project, verify it appears in the project list
- Happy path: rename a project, verify the new name displays
- Happy path: delete a project, confirmation dialog shows count of affected items (documents, codes, codings, memos), confirming soft-deletes all child entities
- Edge case: project list is empty, display a "create your first project" prompt. Apply the same pattern across the app: empty document list shows "upload your first document," empty codebook shows "create your first code," empty query results shows "no matching segments," empty memo list shows contextual prompt.
- Edge case: project name is very long, verify it truncates gracefully
- Edge case: delete a project with many documents, verify all child entities receive `deletedAt` timestamps

**Verification:**
- Three-panel layout renders at desktop widths matching the mockup proportions
- Creating a project navigates to the project view
- Project data persists across page refreshes (IndexedDB)
- Project deletion shows confirmation with impact summary, cascades to all child entities

---

### Phase B: Content Pipeline

- [ ] **Unit 4: Document upload modal and text ingestion**

**Goal:** Build the upload modal with purpose/language/date fields and handle plain text file ingestion.

**Requirements:** R7, R10, R11

**Dependencies:** Unit 3

**Files:**
- Create: `src/components/upload/UploadModal.tsx`
- Create: `src/components/upload/FileDropzone.tsx`
- Create: `src/components/upload/MetadataForm.tsx`
- Create: `src/lib/ingestion/textIngester.ts`
- Create: `src/lib/ingestion/fileRouter.ts` (routes files by MIME type to the correct ingester)
- Modify: `src/app/(app)/projects/[projectId]/page.tsx` (add upload button)
- Modify: `src/lib/db/operations.ts` (add document creation)
- Test: `src/lib/ingestion/__tests__/textIngester.test.ts`
- Test: `src/lib/ingestion/__tests__/fileRouter.test.ts`

**Approach:**
- Upload modal matches mockup: drag-and-drop zone, purpose selector (Primary/Secondary/Context), language dropdown (Bangla, English, Hindi, Indonesian, plus "Other" with text input), date picker, notes textarea
- File router checks MIME type: `audio/*` → Gemini pipeline (Unit 6), `application/pdf`, `image/*`, spreadsheet types → Reducto pipeline (Unit 5), `text/*` → text ingester
- Text ingester reads file content as UTF-8 string, stores as canonical markdown in Dexie
- All documents get: `status: 'ready'` (text) or `status: 'pending'` (needs API processing)
- **Pending document queue:** Documents uploaded offline or without API keys get `status: 'pending'`. The document list shows pending documents with a visual indicator. On connectivity restore (or after API keys are configured), the app auto-processes all pending documents. Processing is serial to respect API rate limits. If the browser closes mid-queue, pending documents persist in IndexedDB and resume on next app load.
- Accepted file types: audio (mp3, wav, m4a, ogg, flac), pdf, docx, xlsx, csv, txt, md, png, jpg, jpeg, tiff

**Patterns to follow:**
- Mockup: upload modal with file drop, purpose tabs, language dropdown, date field, notes

**Test scenarios:**
- Happy path: upload a .txt file, verify document created in Dexie with correct content, purpose, language, date
- Happy path: upload a .md file, verify content stored as-is
- Happy path: file router identifies audio MIME type and routes to Gemini pipeline
- Happy path: file router identifies PDF and routes to Reducto pipeline
- Edge case: file with no extension, router falls back based on MIME type
- Edge case: upload with missing required fields (purpose, language), form validation prevents submission
- Error path: file read fails (corrupt file), display error in modal

**Verification:**
- Upload modal opens, accepts a file, shows metadata form
- Submitting a .txt file creates a document visible in the left panel document list
- Document content is readable in the center panel

---

- [ ] **Unit 5: Reducto integration (PDF, scan, image parsing)**

**Goal:** Parse PDFs, scanned documents, handwritten notes, spreadsheets, and images via Reducto API into clean markdown.

**Requirements:** R9, R11

**Dependencies:** Unit 4

**Files:**
- Create: `src/app/api/reducto/parse/route.ts` (API route proxy)
- Create: `src/lib/ingestion/reductoIngester.ts` (client-side orchestration)
- Create: `src/lib/api/reducto.ts` (typed Reducto client)
- Create: `src/types/reducto.ts` (Zod schemas for Reducto responses)
- Modify: `src/lib/ingestion/fileRouter.ts` (wire up Reducto route)
- Modify: `src/components/upload/UploadModal.tsx` (show processing status)
- Test: `src/lib/ingestion/__tests__/reductoIngester.test.ts`
- Test: `src/lib/api/__tests__/reducto.test.ts`

**Approach:**
- API route at `/api/reducto/parse`: reads `X-Reducto-Key` header, uploads file to Reducto via SDK, calls `/parse`, returns structured response
- For scanned/handwritten documents: use `extraction_mode: "ocr"` with `ocr_system: "standard"` (supports multilingual)
- For documents with figures: enable `return_images: ["figure"]` and `summarize_figures: true`
- Validate Reducto response with Zod schema before storing
- Store parsed markdown in `document.content`, file metadata in `document.metadata`
- Document status progression: `pending` → `processing` → `ready` (or `error`)
- Show processing spinner in the document list while status is `processing`

**Patterns to follow:**
- Reducto Node SDK pattern: upload file, parse by file_id, extract content blocks
- API route proxy pattern: key from header, upstream call, normalized response

**Test scenarios:**
- Happy path: send a PDF through the API route, verify Reducto SDK is called with correct parameters, response parsed into markdown
- Happy path: scanned document uses OCR mode, verify `extraction_mode: "ocr"` is set
- Happy path: document with figures returns image URLs and summaries
- Edge case: large file (>20MB) uses Reducto's presigned upload
- Error path: invalid API key returns 401 with clear error message
- Error path: Reducto API timeout, document status set to `error` with retry option
- Integration: upload a PDF through the modal, verify document appears in list with `processing` status, then transitions to `ready`

**Verification:**
- Upload a PDF, see it processing, then view the parsed markdown in the document viewer
- Scanned document with handwritten text produces readable markdown
- Missing or invalid Reducto API key shows a clear error directing user to Settings

---

- [ ] **Unit 6: Gemini integration (audio transcription)**

**Goal:** Transcribe audio files via Gemini API with speaker diarization, timestamps, and optional English translation.

**Requirements:** R8, R11

**Dependencies:** Unit 4

**Files:**
- Create: `src/app/api/gemini/transcribe/route.ts` (API route proxy)
- Create: `src/lib/ingestion/geminiIngester.ts` (client-side orchestration)
- Create: `src/lib/api/gemini.ts` (typed Gemini client)
- Create: `src/types/gemini.ts` (Zod schemas for transcription response)
- Modify: `src/lib/ingestion/fileRouter.ts` (wire up Gemini route)
- Test: `src/lib/ingestion/__tests__/geminiIngester.test.ts`
- Test: `src/lib/api/__tests__/gemini.test.ts`

**Approach:**
- API route: reads `X-Gemini-Key` header. For files >20MB, uses Gemini Files API to upload first. Then calls `generateContent` with the audio and a transcription prompt.
- Prompt requests: speaker-labeled, timestamped transcription in original language, with English translation per segment. Uses `response_mime_type: "application/json"` with `response_schema` enforcing: `{ segments: [{ speaker, timestamp, content, language, translation }] }`
- Validate response with Zod before storing. **Enforce 1:1 segment correspondence:** the Zod schema must validate that every segment has both `content` and `translation` fields. If Gemini returns mismatched arrays (e.g., one original segment split into multiple translation entries), normalize by concatenating split translations back into one entry per original segment before storage.
- Store segments as `document.segments[]` array. Build `document.content` by joining segment content. Build `document.translationContent` by joining translations.
- Store the uploaded audio binary in the `binaryAssets` table (Dexie) with a reference from the document record. wavesurfer.js loads audio from a Blob URL created from this asset. The binary syncs to Drive separately (Unit 12).
- For long interviews (>2 hours), consider chunking with overlap for speaker consistency (deferred to implementation: user reports 20MB chunks work well with Gemini for Bangla)

**Patterns to follow:**
- Gemini structured output pattern from ai.google.dev docs
- Same API route proxy pattern as Reducto (Unit 5)

**Test scenarios:**
- Happy path: send audio file, verify Gemini called with correct prompt and response schema, segments parsed correctly
- Happy path: response includes speaker labels, timestamps, original text, and translation
- Happy path: canonical markdown content built by joining segment content with speaker headers
- Edge case: audio file >20MB uses Files API upload first
- Edge case: Gemini returns segments with unknown language code, store as-is
- Error path: invalid API key returns clear error
- Error path: Gemini response doesn't match schema, Zod validation catches it, document status set to `error`
- Integration: upload an audio file through the modal, verify document appears with segments and translation content

**Verification:**
- Upload an audio file, see processing status, then view transcribed segments with speaker labels
- Translation text appears alongside original language text
- Missing Gemini API key shows error directing to Settings

---

- [ ] **Unit 7: Document viewer (markdown + audio player)**

**Goal:** Build the center panel document viewer with markdown rendering for text documents and an audio player with waveform and segment navigation for audio documents.

**Requirements:** R8, R11

**Dependencies:** Units 4, 5, 6

**Files:**
- Create: `src/components/viewer/DocumentViewer.tsx` (routes to text or audio viewer)
- Create: `src/components/viewer/MarkdownViewer.tsx` (renders markdown content)
- Create: `src/components/viewer/AudioViewer.tsx` (waveform + segments)
- Create: `src/components/viewer/SegmentList.tsx` (timestamped speaker segments)
- Create: `src/components/viewer/DocumentHeader.tsx` (title, date, language, metadata)
- Create: `src/hooks/useDocument.ts` (Dexie query for current document)
- Modify: `src/components/layout/CenterPanel.tsx` (render DocumentViewer)
- Modify: `src/app/(app)/projects/[projectId]/page.tsx` (wire document selection)
- Test: `src/components/viewer/__tests__/DocumentViewer.test.ts`

**Approach:**
- `DocumentViewer` checks `document.fileType`: audio → `AudioViewer`, everything else → `MarkdownViewer`
- `MarkdownViewer`: renders `document.content` into a single stable container with predictable text-node structure (one container per paragraph/segment). **Critical constraint for Unit 9:** the renderer must produce byte-for-byte consistent output from the stored `content` string so character offsets remain stable. Do not use a markdown library that normalizes whitespace or restructures content at render time. Render as pre-split text nodes rather than passing through a transforming pipeline. Uses serif font (Source Serif 4) per design direction. If `translationContent` exists, shows it inline in italics below each paragraph/segment.
- `AudioViewer`: integrates wavesurfer.js for waveform. Loads audio from `binaryAssets` table via Blob URL. Displays segments below the waveform. Clicking a segment seeks audio to that timestamp. Current segment highlighted during playback.
- `DocumentHeader`: title, date collected, language badge, purpose badge, speaker count and duration for audio
- Document list in left panel: grouped by purpose (PRIMARY, SECONDARY, CONTEXT) with counts, matching the mockup

**Patterns to follow:**
- Mockup: document header with metadata, waveform visualization, speaker-labeled segments with original + translation
- wavesurfer.js regions plugin for segment markers

**Test scenarios:**
- Happy path: select a text document, markdown renders with serif font
- Happy path: select an audio document, waveform renders, segments listed with speaker labels
- Happy path: click a segment, audio seeks to that timestamp
- Happy path: bilingual document shows original text with translation in italics below
- Edge case: document with no content (still processing), show loading state
- Edge case: very long document (500+ paragraphs), verify scroll performance
- Edge case: audio document with no segments (processing failed), show error state

**Verification:**
- Text documents render formatted markdown with serif font
- Audio documents show waveform, clickable segments seek playback
- Translation text appears in italics below original language text

---

### Phase C: Analysis Tools

- [ ] **Unit 8: Codebook management**

**Goal:** Build the codebook view with hierarchical code tree, inline editing (rename, redefine, merge, split), and codebook import.

**Requirements:** R13, R17, R18

**Dependencies:** Unit 3

**Files:**
- Create: `src/app/(app)/projects/[projectId]/codebook/page.tsx`
- Create: `src/components/codebook/CodebookView.tsx` (two-panel: tree + detail)
- Create: `src/components/codebook/CodeTree.tsx` (hierarchical code list with expand/collapse)
- Create: `src/components/codebook/CodeDetail.tsx` (selected code: definition, stats, quotations)
- Create: `src/components/codebook/CodeForm.tsx` (add/edit code form)
- Create: `src/components/codebook/CodebookImport.tsx` (import review step)
- Create: `src/components/codebook/MergeCodeModal.tsx`
- Create: `src/lib/codebook/importParser.ts` (parse CSV/JSON/markdown codebooks)
- Create: `src/lib/codebook/codebookOperations.ts` (merge, split, reorder)
- Create: `src/hooks/useCodebook.ts` (Dexie query for project codes)
- Test: `src/lib/codebook/__tests__/importParser.test.ts`
- Test: `src/lib/codebook/__tests__/codebookOperations.test.ts`

**Approach:**
- Code tree: collapsible hierarchy. Each code shows name, color swatch, provenance badge (user/ai/ai_edited/imported), and count of coded segments.
- Code detail panel: definition, stats (coded segments count, document count, co-occurring codes count), recent quotations with source document reference. Edit/Merge/Delete actions.
- Add code: name, parent (optional), definition, color picker. Provenance auto-set to `user`.
- Merge: select target code, all codings from source transfer to target, source deleted.
- Split: create a new child code from a parent, optionally reassign specific codings.
- Import parser: validates CSV (columns: name, parent, definition, color), JSON, or markdown against Zod schemas. Shows review step before committing. Imported codes tagged `imported`.
- Import uses the same upload modal component but with a "review before importing" intermediate step.

**Patterns to follow:**
- Mockup: codebook view with code tree (left) and code detail (right), AI suggestions queue (phase 2), provenance badges

**Test scenarios:**
- Happy path: create a code with name, definition, color. Verify it appears in tree.
- Happy path: create a child code under a parent. Verify hierarchy displays correctly.
- Happy path: rename a code. Verify all codings still reference it.
- Happy path: merge code A into code B with synthetic codings on code A. Verify all codings transferred to code B, code A soft-deleted, linked codings updated.
- Happy path: import CSV codebook. Verify codes created with `imported` provenance.
- Edge case: import codebook where "Trust" has parent "Themes" but local "Trust" already exists under parent "Relationships". Review step flags the hierarchy conflict.
- Edge case: import codebook with parent references. Parent must be created before child.
- Edge case: import codebook with duplicate names. Show conflict in review step.
- Error path: import CSV with missing required columns. Show validation error.
- Error path: delete a parent code with children. Prompt to reassign or delete children.

**Verification:**
- Code tree displays hierarchical codes with colors and provenance
- Inline editing (rename, redefine) works and persists
- Codebook import from CSV creates codes with review step

---

- [ ] **Unit 9: Coding engine (text selection + code application)**

**Goal:** Enable highlighting text spans in documents and tagging them with codes. Support bilingual span linking for audio documents with translation tracks.

**Requirements:** R12, R14, R15, R16

**Dependencies:** Units 7, 8

**Files:**
- Create: `src/components/editor/TextAnnotator.tsx` (text rendering with highlights + selection handling)
- Create: `src/components/editor/CodePicker.tsx` (search dropdown for code selection)
- Create: `src/components/editor/HighlightLayer.tsx` (renders colored highlight overlays)
- Create: `src/components/editor/QuotationMemo.tsx` (memo attached to a coding)
- Create: `src/lib/coding/offsetUtils.ts` (character offset calculation and overlap resolution)
- Create: `src/lib/coding/spanLinker.ts` (bilingual span linking logic)
- Create: `src/hooks/useCodingActions.ts` (create/delete codings via Dexie)
- Modify: `src/components/viewer/MarkdownViewer.tsx` (integrate TextAnnotator)
- Modify: `src/components/viewer/SegmentList.tsx` (integrate TextAnnotator for audio segments)
- Test: `src/lib/coding/__tests__/offsetUtils.test.ts`
- Test: `src/lib/coding/__tests__/spanLinker.test.ts`

**Approach:**
- `TextAnnotator` wraps document content. On text selection, captures start/end character offsets relative to the content container. Opens `CodePicker` dropdown.
- `CodePicker`: search-as-you-type dropdown listing all codes. Recently used codes pinned at top. Keyboard shortcut support (e.g., last 5 codes mapped to number keys 1-5).
- `HighlightLayer`: at render time, splits text into spans at offset boundaries. Each span styled with the code's color as background. Overlapping codings show mixed colors.
- Clicking a highlight shows the coding detail: codes applied, quoted text, option to add a quotation memo.
- **Bilingual linking**: for audio documents, when the user codes a span in the original text, `spanLinker` identifies which segment(s) the selection covers (by checking offset ranges against segment boundaries). It creates a linked coding on the corresponding translation segments (and vice versa). `linkedCodingId` cross-references the pair.
- Quotation memos: when viewing a coding, user can attach a free-text memo. Stored as a Memo with `targetType: 'quotation'` and `targetId` pointing to the coding.

**Patterns to follow:**
- Native Selection API for span capture
- Mockup: highlighted text spans with color-coded backgrounds, code labels

**Test scenarios:**
- Happy path: select text, choose a code, verify coding created with correct offsets and quoted text
- Happy path: apply multiple codes to same span, verify overlapping highlights render
- Happy path: search for a code in CodePicker, verify filtering works
- Happy path: recently used code appears at top of CodePicker
- Happy path: code a span in original text of bilingual document, verify linked coding created on translation
- Happy path: attach a quotation memo to a coding, verify it persists
- Edge case: selection spans across two paragraphs, verify offset calculation handles newlines
- Edge case: delete a coding, verify highlight removed and linked coding also removed
- Edge case: code applied to translation text, verify linked coding on original
- Error path: attempt to code when no codes exist in codebook, prompt to create a code first

**Verification:**
- Select text, apply a code, see colored highlight appear
- Highlight persists across page refresh
- Bilingual coding creates linked spans in both language tracks
- Quotation memos display when clicking a highlight

---

- [ ] **Unit 10: Memos and query/retrieval**

**Goal:** Build the memo system (project/document/code/quotation memos) and the query interface for filtering coded segments, co-occurrence, and word frequency.

**Requirements:** R19, R20, R21, R22, R23

**Dependencies:** Units 8, 9

**Files:**
- Create: `src/components/memos/MemoEditor.tsx` (markdown editor for memos)
- Create: `src/components/memos/MemoList.tsx` (list memos for a target)
- Create: `src/components/query/QueryPanel.tsx` (filter interface)
- Create: `src/components/query/CoOccurrenceView.tsx` (segments with both code X and Y)
- Create: `src/components/query/QuotationList.tsx` (all quotations for a code with context)
- Create: `src/components/query/WordFrequency.tsx` (word frequency table)
- Create: `src/lib/query/queryEngine.ts` (filtering, co-occurrence, word frequency logic)
- Create: `src/hooks/useMemos.ts`
- Create: `src/hooks/useQuery.ts`
- Modify: `src/components/layout/RightPanel.tsx` (add memo and query access)
- Test: `src/lib/query/__tests__/queryEngine.test.ts`

**Approach:**
- Memos: simple markdown textarea with preview toggle. Each memo has a `targetType` (project/document/code/quotation) and `targetId`. Memos searchable across the project via Dexie full-text query.
- Query panel accessible via "Search" link in the top-right (per mockup). Filter controls: code multi-select, purpose dropdown, language dropdown, date range, free text search.
- Co-occurrence: query engine finds all codings where document segments have both code X and code Y applied. Uses Dexie compound queries on `[documentId+codeId]`.
- Quotation list: for a selected code, show all coded segments with surrounding context (a few sentences before and after the highlighted span).
- Word frequency: tokenize document content, count occurrences, display sorted table. Filter by subset of documents.

**Patterns to follow:**
- Mockup: right panel has "Search" and "Memo" links in top-right header area

**Test scenarios:**
- Happy path: create a memo on a project, verify it persists and appears in memo list
- Happy path: create a memo on a quotation, verify it's accessible from the coding detail
- Happy path: search memos by keyword, verify matching memos returned
- Happy path: filter codings by code, verify only matching segments returned
- Happy path: filter codings by purpose + language, verify compound filter works
- Happy path: co-occurrence query for codes X and Y, verify segments tagged with both returned
- Happy path: view all quotations for a code, verify surrounding context included
- Happy path: word frequency returns sorted list with counts
- Edge case: co-occurrence query with no matches, display empty state
- Edge case: word frequency on documents with mixed languages, tokenization handles non-Latin scripts

**Verification:**
- Create memos at each level (project, document, code, quotation) and verify they display
- Filter coded segments by code and purpose, see correct results
- Co-occurrence query returns expected segments
- Word frequency displays a sorted table

---

### Phase D: Export, Sync, and Stubs

- [ ] **Unit 11: Export**

**Goal:** Export coded segments as CSV, codebook as CSV/JSON, full project as JSON, and memo reports as Markdown.

**Requirements:** R24, R25, R26, R27

**Dependencies:** Units 8, 9, 10

**Files:**
- Create: `src/components/export/ExportMenu.tsx` (dropdown with export options)
- Create: `src/lib/export/csvExporter.ts` (coded segments and codebook as CSV)
- Create: `src/lib/export/jsonExporter.ts` (full project export)
- Create: `src/lib/export/markdownExporter.ts` (memo reports)
- Create: `src/lib/export/downloadHelper.ts` (trigger file download in browser)
- Modify: `src/components/layout/RightPanel.tsx` (add Export link per mockup)
- Test: `src/lib/export/__tests__/csvExporter.test.ts`
- Test: `src/lib/export/__tests__/jsonExporter.test.ts`

**Approach:**
- Export menu accessible via "Export" link in top-right (per mockup). Options: Coded Segments (CSV), Codebook (CSV), Codebook (JSON), Full Project (JSON), Memos (Markdown).
- CSV coded segments: columns for document title, code name, parent code, quoted text, start offset, end offset, purpose, language, date collected, memo (if any)
- CSV codebook: columns for name, parent, definition, color, provenance, segment count
- JSON project: complete dump of all project data (documents without binary content, codes, codings, memos)
- Markdown memos: grouped by target type, with headers and context
- All exports trigger a browser file download via `URL.createObjectURL` + `<a>` click

**Patterns to follow:**
- Mockup: "Export" link in top-right header

**Test scenarios:**
- Happy path: export coded segments as CSV, verify header row and data rows match expected format
- Happy path: export codebook as CSV, verify hierarchical codes represented with parent column
- Happy path: export full project as JSON, verify all entities included
- Happy path: export memos as Markdown, verify grouping by target type
- Edge case: export with no coded segments, CSV has header only
- Edge case: quoted text containing commas and newlines, verify CSV escaping

**Verification:**
- Each export option triggers a file download
- Downloaded CSV opens correctly in a spreadsheet app
- Downloaded JSON validates against the project schema

---

- [ ] **Unit 12: Google Drive sync**

**Goal:** Implement bidirectional sync between IndexedDB and Google Drive `appDataFolder`. Handle offline queuing, conflict resolution, multi-tab coordination, and startup integrity checks.

**Requirements:** R2, R3, R4

**Dependencies:** Units 1, 2 (foundation), all data-producing units should exist

**Execution note:** This is the highest-risk cross-layer component. Consider building a minimal sync skeleton (push dirty records, pull manifest, basic round-trip) early in Phase B to validate the core architecture before all data-producing units are built on top of it. The full conflict resolver, binary sync, and multi-tab coordination can complete in Phase D.

**Files:**
- Create: `src/lib/sync/driveClient.ts` (Google Drive API wrapper for appDataFolder operations)
- Create: `src/lib/sync/syncEngine.ts` (orchestrates push/pull cycle)
- Create: `src/lib/sync/conflictResolver.ts` (field-level merge with LWW fallback)
- Create: `src/lib/sync/manifest.ts` (manifest.json management)
- Create: `src/lib/sync/binarySync.ts` (upload/download binary files to Drive)
- Create: `src/hooks/useSync.ts` (sync status, trigger manual sync)
- Create: `src/hooks/useOnlineStatus.ts` (reactive online/offline detection)
- Create: `src/components/sync/SyncIndicator.tsx` (status badge: synced, syncing, offline, error)
- Test: `src/lib/sync/__tests__/syncEngine.test.ts`
- Test: `src/lib/sync/__tests__/conflictResolver.test.ts`

**Approach:**
- `driveClient`: wraps Google Drive REST API v3 calls. Uses OAuth access token from Auth.js session. Operations: list files in appDataFolder, create/update/get file content, delete file. Uses `If-Match` ETag headers for safe writes.
- `syncEngine`: on each sync cycle: (1) push all `_dirty` records to Drive, grouped by entity type; (2) pull manifest, compare timestamps, fetch updated remote records; (3) merge via `conflictResolver`; (4) update local `_dirty` flags and `syncMeta` table.
- `conflictResolver`: uses `_lastSyncedSnapshot` to determine which fields each side changed. Diffs local-current vs. snapshot and remote-current vs. snapshot. If only local changed: push. If only remote changed: pull. If both changed on different fields: merge. Same field on both sides: newer `updatedAt` wins.
- **Startup integrity check:** on app load, compare local `syncMeta` against the Drive manifest. If local data is missing that Drive has, pull it. If local has dirty records that Drive does not have, surface a sync-needed indicator. Protects against IndexedDB eviction by the browser.
- **appDataFolder quota monitoring:** check quota usage via Drive API `about.get` on each sync cycle. Surface a warning in SyncIndicator when usage exceeds 80%.
- Binary files (audio, PDFs): upload to Drive as individual files in appDataFolder via `binarySync.ts`. Store Drive file ID in `binaryAssets` table. Download on first access if not cached locally.
- `manifest.json`: lists all entity files with Drive file IDs and last-modified timestamps. Enables incremental sync without listing all Drive files every cycle.
- Sync triggers: `online` event, `visibilitychange`, 60-second periodic interval while online.
- Multi-tab: `navigator.locks.request("drive-sync", ...)` ensures only one tab runs the sync loop.
- `SyncIndicator`: small badge showing sync state. Offline mode shows an indicator but doesn't block any functionality.

**Patterns to follow:**
- Google Drive REST API v3 documentation
- Web Locks API for cross-tab coordination

**Test scenarios:**
- Happy path: create a project offline, go online, verify project synced to Drive
- Happy path: modify a document on device A, sync, open on device B, verify changes present
- Happy path: field-level merge: device A changes code name, device B changes code color, both merge correctly
- Happy path: binary file (audio) uploaded to Drive, downloadable on another session
- Edge case: same field modified on two devices, newer timestamp wins
- Edge case: network drops mid-sync, partial push handled gracefully, retried on next cycle
- Edge case: manifest.json doesn't exist on first sync, create it
- Edge case: two tabs open, only one runs the sync loop (Web Locks)
- Error path: OAuth token expired, refresh token and retry
- Error path: Drive API rate limited, exponential backoff
- Integration: create data offline, restore connectivity, verify full round-trip sync

**Verification:**
- SyncIndicator shows correct status (synced/syncing/offline/error)
- Data created offline appears in Drive appDataFolder after going online
- Opening the app on a fresh browser loads data from Drive

---

- [ ] **Unit 13: Phase 2 stubs (AI codebook + auto-summary)**

**Goal:** Define typed interfaces for AI-assisted codebook suggestions and auto-summary. Implement placeholder UI showing where these features will live. No AI logic.

**Requirements:** R29, R30

**Dependencies:** Units 8, 7

**Files:**
- Create: `src/types/ai.ts` (interfaces for codebook suggestions and summaries)
- Create: `src/components/codebook/AiSuggestionsQueue.tsx` (placeholder UI with sample data)
- Create: `src/components/summary/ProjectSummary.tsx` (placeholder UI in right panel)
- Create: `src/lib/ai/codebookSuggester.ts` (stub: typed interface, returns empty array)
- Create: `src/lib/ai/summarizer.ts` (stub: typed interface, returns placeholder text)
- Modify: `src/components/codebook/CodebookView.tsx` (add suggestions queue section)
- Modify: `src/components/layout/RightPanel.tsx` (add summary section)

**Approach:**
- `AiSuggestion` type: `{ id, name, parentSuggestion, definition, evidence, sourceDocumentIds, status: 'pending' | 'accepted' | 'edited' | 'dismissed' }`
- `ProjectSummary` type: `{ content: string, citations: { claim: string, documentIds: string[] }[], generatedAt: Date }`
- `AiSuggestionsQueue` UI: matches mockup (card per suggestion with Accept/Edit/Dismiss actions). Shows "AI suggestions will appear here as you add documents" placeholder.
- `ProjectSummary` UI: matches mockup (summary text with "2h ago" timestamp). Shows "Summary will be generated after adding primary documents" placeholder.
- Stub functions return empty results but have full type signatures so phase 2 implementation is a drop-in replacement.

**Patterns to follow:**
- Mockup: AI suggestions queue in codebook view, summary section in right panel

**Test scenarios:**
- Happy path: codebook view renders the suggestions queue section with placeholder text
- Happy path: right panel renders the summary section with placeholder text
- Happy path: stub functions return correct types (empty array for suggestions, placeholder for summary)

**Verification:**
- Codebook view shows "AI Suggestions" section matching mockup layout
- Right panel shows "Summary" section matching mockup layout
- TypeScript compiles without errors, ensuring interfaces are complete for phase 2

## System-Wide Impact

- **Interaction graph:** All data mutations flow through `src/lib/db/operations.ts`, which sets `_dirty: true`. The sync engine reads dirty records and pushes to Drive. Dexie's `useLiveQuery` propagates changes to all subscribed components and across tabs.
- **Error propagation:** API errors (Gemini, Reducto) use the shared `ApiErrorResponse` type (`{ error, code, retryable }`). Document processing errors surface as `status: 'error'` with a retry option. Drive sync errors show in the SyncIndicator. When the sync engine detects a 401 from Drive (expired OAuth token), it surfaces a prominent re-auth notification (not just the badge) and pauses new ingestion jobs until the user re-authenticates, since processed results won't sync.
- **Character offset immutability (architectural invariant):** Character offsets in codings are tied to the stored `content` string. That string must never be mutated or re-normalized after codings exist. The viewer must render exactly what is stored, byte-for-byte, in regions where offsets apply. This constraint is easy to violate during UI refactoring and should be documented prominently in ARCHITECTURE.md.
- **State lifecycle risks:** Re-processing a document (re-uploading the same file) would invalidate existing codings. Strategy: Unit 4's upload modal detects when a file matches an existing document (by name + project) and shows a confirmation dialog listing affected coding count before clearing codings on re-process. Deletions propagate via soft-delete (`deletedAt` tombstones) to avoid deleted records reappearing after sync.
- **Cross-tab coding:** Two tabs with the same document open must handle concurrent coding. Dexie's `useLiveQuery` propagates new codings across tabs, but `HighlightLayer` must reactively recompute offset splits from the full coding set. Stale queries could produce rendering glitches. This scenario needs explicit testing.
- **IndexedDB eviction risk:** Browser updates or storage pressure can silently evict IndexedDB data. The startup integrity check (Unit 12) compares local state against the Drive manifest and pulls missing data. Dirty records not yet synced could be lost; the sync indicator warns when unsynced changes exist.
- **API surface parity:** All data operations work identically online and offline. API calls (ingestion) require connectivity; the app queues the document as `pending` and auto-processes when connectivity and API keys are available.
- **Integration coverage:** The sync engine is the highest-risk cross-layer component. It touches Dexie, Drive API, conflict resolution, and multi-tab coordination. Dedicated integration tests for full round-trip sync are essential.

## Risks & Dependencies

- **Gemini diarization accuracy**: Bangla transcription quality is validated (user tested 20MB chunks with near-perfect results). Diarization (speaker separation) is prompt-based and may vary. Indonesian support needs similar validation. Mitigation: test diarization against a known multi-speaker recording early. Fallback: users manually correct speaker labels.
- **appDataFolder quota limits**: Google Drive appDataFolder has a default quota of ~10-25MB per app (varies by Google Cloud project config, can be increased). A project with many transcribed documents could exceed this. Mitigation: monitor quota via `about.get`, warn at 80%, store document content as individual Drive files (not in per-project JSON blobs), request quota increase in Google Cloud Console if needed.
- **IndexedDB storage limits**: Browsers limit IndexedDB to ~50% of available disk. Large audio files could fill this. Mitigation: `binaryAssets` table stores audio locally for offline playback but syncs to Drive. Consider evicting local binary cache for old documents while keeping metadata.
- **Character offset stability**: Stored `content` string is the anchor for all coding offsets. Re-processing a document invalidates existing codings. Mitigation: confirmation dialog with affected coding count, clear codings on re-process. The viewer must never re-normalize content at render time (architectural invariant).
- **OAuth token lifecycle**: Auth.js manages token refresh, but long offline periods (weeks) may invalidate the refresh token entirely. Mitigation: prominent re-auth notification (not just SyncIndicator badge), pause ingestion until re-authenticated, local data preserved in IndexedDB until sync resumes.
- **wavesurfer.js bundle size**: ~100KB gzipped. Acceptable for desktop but worth monitoring.

## Documentation / Operational Notes

- `docs/ARCHITECTURE.md` should be written in Unit 1 and kept updated. Written in plain language for the pedagogical goal.
- All components should have generous comments explaining the "why" for the learning contributor.
- Named functions preferred over deeply nested anonymous ones throughout.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-29-qual-coding-tool-requirements.md](docs/brainstorms/2026-04-29-qual-coding-tool-requirements.md)
- Reducto API: https://docs.reducto.ai/agent-guide, Node SDK `reductoai`
- Gemini Audio API: https://ai.google.dev/gemini-api/docs/audio
- Dexie.js: https://dexie.org, `useLiveQuery` for reactive IndexedDB
- Auth.js v5: https://authjs.dev
- wavesurfer.js: https://wavesurfer.xyz
- Google Drive API v3 appDataFolder: https://developers.google.com/workspace/drive/api/guides/appdata
- Web Locks API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
