# Architecture

This document explains how the qualitative coding tool is built, in plain language. It's written for contributors who are new to the codebase.

## What the app does

This is a tool for qualitative researchers who work with interviews, focus group discussions, field notes, and other documents. They upload source material (audio recordings, scanned PDFs, text files), then "code" the content by highlighting passages and tagging them with thematic labels. The tool handles multilingual content (Bangla, English, Indonesian, Hindi) and works offline for fieldwork in areas with unreliable internet.

## Local-first architecture

All data lives in your browser first. We use **IndexedDB** (via a library called Dexie.js) as the working database. When you're online, data syncs to **Google Drive** as a backup. This means:

- The app works without internet. You can code documents, create memos, and manage your codebook offline.
- When you go back online, your changes push to Drive automatically.
- If you open the app on a different computer, it pulls your data from Drive.

There is no server-side database. The Next.js server only does two things: handle Google sign-in and proxy API calls to external services (Gemini, Reducto).

## Data model

Every entity in the database shares a common set of "sync tracking" fields (defined in `SyncableEntity` in `src/types/index.ts`):

- `_dirty`: true when you've changed something locally that hasn't been pushed to Drive yet
- `_lastSyncedSnapshot`: a frozen copy of the record from the last successful sync, used to figure out which fields changed when resolving conflicts
- `deletedAt`: non-null means the record is soft-deleted. The sync engine propagates the deletion to Drive, then removes the record locally.

The main entities are:

| Entity | What it holds |
|--------|--------------|
| Project | A research project. Contains documents, codes, codings, and memos. |
| Document | An uploaded file (interview transcript, PDF, field notes). Stores the parsed content as a markdown string. |
| Code | A thematic label in the codebook (e.g., "Land > Compensation"). Hierarchical via parentId. |
| Coding | A highlighted span in a document tagged with a code. Stored as character offsets into the document's content string. |
| Memo | A free-text note attached to a project, document, code, or specific coding. |
| BinaryAsset | The raw uploaded file (audio, PDF) stored as a Blob for offline playback. |

### Character offset invariant

**This is the most important rule in the codebase.** Codings store character offsets (`startOffset`, `endOffset`) that point into a document's `content` string. That string must never be modified after codings exist. If the viewer renders content differently than what's stored (normalizing whitespace, reformatting markdown), offsets break and every existing coding becomes wrong. The document viewer renders stored content byte-for-byte.

## State management

Two systems, with clear responsibilities:

- **Dexie.js + useLiveQuery**: all persisted data. Projects, documents, codes, codings, memos. Dexie's `useLiveQuery` hook makes React components re-render automatically when IndexedDB data changes, even across browser tabs.

- **Zustand** (`src/lib/stores/uiStore.ts`): ephemeral UI state only. Which document is selected, which panel is visible, the current text selection. This state doesn't persist across page reloads and doesn't sync anywhere.

## File structure

```
src/
  app/                    # Next.js App Router pages and layouts
    page.tsx              # Landing / sign-in page
    (app)/                # Route group for authenticated views
      layout.tsx          # Auth guard + three-panel shell
      projects/           # Project list and project view
      settings/           # API key settings
  components/             # React components, organized by feature
    layout/               # AppShell, LeftPanel, CenterPanel, RightPanel
    viewer/               # Document viewer, audio player
    editor/               # Text annotator, code picker, highlights
    codebook/             # Code tree, code detail, import
    upload/               # Upload modal, file dropzone
    memos/                # Memo editor and list
    query/                # Query panel, co-occurrence, word frequency
    export/               # Export menu and formatters
  hooks/                  # Custom React hooks
  lib/
    db/                   # Dexie schema and CRUD operations
    stores/               # Zustand stores
    sync/                 # Google Drive sync engine
    ingestion/            # File processing pipeline (text, Reducto, Gemini)
    api/                  # Typed clients for external APIs
    coding/               # Character offset utilities, span linking
    codebook/             # Codebook operations (merge, split, import)
    query/                # Query engine (filtering, co-occurrence)
    export/               # Export formatters (CSV, JSON, Markdown)
  types/                  # TypeScript type definitions
docs/
  ARCHITECTURE.md         # This file
  mockups/                # UI mockup images for design reference
  plans/                  # Implementation plans
  brainstorms/            # Requirements documents
```

## External APIs

The app uses three external APIs, all with BYO (bring your own) keys:

- **Gemini** (Google): transcribes audio with speaker diarization and optional translation. Diarization is prompt-based, not a native API feature.
- **Reducto**: parses PDFs, scanned documents, handwritten notes, and images into clean markdown.
- **Anthropic / OpenAI**: reserved for phase 2 (AI-assisted codebook suggestions, auto-summary).

API keys are stored in the browser's localStorage and sent to our API routes via custom headers (e.g., `X-Gemini-Key`). The API routes proxy the call to the upstream service. Keys never touch our server's storage.

## Google Drive sync

Drive sync uses the `appDataFolder` scope for metadata and a dedicated app folder for binary files (audio, PDFs). The sync cycle:

1. Push all `_dirty` records to Drive
2. Pull the manifest, compare timestamps
3. Merge changes using field-level conflict resolution (diff against `_lastSyncedSnapshot`)
4. Clear `_dirty` flags

Sync triggers: going online, switching back to the tab, and a 60-second periodic check. Only one tab runs the sync loop at a time (enforced via the Web Locks API).
