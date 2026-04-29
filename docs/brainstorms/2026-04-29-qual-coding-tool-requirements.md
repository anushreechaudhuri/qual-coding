---
date: 2026-04-29
topic: qual-coding-tool
---

# Qualitative Coding Tool

## Problem Frame

Qualitative researchers doing fieldwork in multilingual contexts (Bangla, Hindi, English) have two options: expensive desktop software (Atlas.ti, NVivo) or ad-hoc spreadsheets. Both fail at multilingual audio, messy scanned documents, and working in areas with unreliable internet. This tool is a free, open-source, local-first alternative that uses modern AI APIs to handle the hardest parts of qualitative data management: transcription with diarization, document parsing, and (eventually) codebook assistance.

Target users: qualitative researchers, particularly those doing fieldwork in South Asia. PhD students, research assistants, and faculty who need to manage interviews, focus group discussions, field notes, and secondary sources across languages.

## Requirements

### Phase 1 (current build)

**Auth & Storage**

- R1. Google OAuth sign-in. The auth flow grants Google Drive access in the same step.
- R2. Local-first storage using IndexedDB as the working store. Google Drive is the canonical backing store.
- R3. Full offline capability. Users can browse, code, write memos, and edit codebooks without internet. Changes queue locally and sync to Drive when connectivity returns.
- R4. Conflict resolution for offline sync (strategy deferred to planning).

**Project Management**

- R5. Implicit workspace: signing in lands the user on a project list. No workspace creation step.
- R6. Project CRUD: create, rename, delete projects. Each project holds documents, a codebook, codings, and memos.

**Document Ingestion**

- R7. Upload modal asks for: file (drag-and-drop or browse), purpose (primary / secondary / context), language, date collected, and optional notes.
- R8. Audio files route to Gemini API for transcription with speaker diarization. Output: timestamped segments with speaker labels, linked back to playback positions. Optional translation track generated alongside original-language transcription.
- R9. PDFs, scans, handwritten notes, spreadsheets, and images route to Reducto API for parsing. Output: clean markdown with structured metadata.
- R10. Plain text files (.txt, .md) ingest as-is with optional cleanup pass.
- R11. All ingested documents produce a canonical markdown content field plus structured metadata (purpose, language, date, speaker count, duration for audio).

**Coding**

- R12. Highlight any character span in a document and tag it with one or more codes from the codebook.
- R13. Codes are hierarchical (parent/child), each with a name, definition, color, and provenance (user, ai, ai_edited, imported).
- R14. Quick-apply via search dropdown and hotkeys for recently used codes.
- R15. Quotation memos: free-text notes attachable to specific coded segments.
- R16. Coding works on both original-language text and translation text. Spans are linked: coding in one language surface maps to the corresponding span in the other.

**Codebook**

- R17. Inline editing: rename, merge, split, redefine codes directly in the codebook view.
- R18. Codebook import from CSV (columns: name, parent, definition, color), JSON, or markdown matching a documented schema. Import uses the upload modal but routes to a "review codes before importing" step. Imported codes tagged with `imported` provenance.

**Memos**

- R19. Free-text markdown memos attachable to a project, document, code, or quotation. Searchable across the project.

**Query & Retrieval**

- R20. Filter coded segments by code, document purpose, language, date, and custom attributes.
- R21. Code co-occurrence: find segments tagged with both code X and code Y.
- R22. View all quotations for a code with surrounding context.
- R23. Word frequency across documents or filtered subsets.

**Export**

- R24. CSV of coded segments.
- R25. Codebook with definitions as CSV/JSON.
- R26. Full project export as JSON.
- R27. Memo reports as Markdown.

**Settings**

- R28. BYO API keys: settings UI where users paste their Gemini, Reducto, Anthropic, and OpenAI API keys. Keys stored in browser localStorage, never sent to any server other than the respective API endpoints.

### Phase 2 (stubbed with typed interfaces in phase 1)

- R29. AI-assisted codebook: as primary documents are added or coded, the system periodically proposes new codes. Suggestions appear in a review queue. Each can be accepted, edited then accepted, or dismissed. Dismissed suggestions are remembered to avoid recurrence.
- R30. Auto-summary: each project has a living summary that updates as documents are added. Re-runs on demand or after N new primary docs. Summary cites which documents informed each claim. Debounced and cached to control token spend.

## Success Criteria

- A researcher can sign in, create a project, upload a Bangla audio file and a scanned PDF, get usable transcription and parsed content, then manually code segments and export the results.
- The app works fully offline after initial load and data cache, syncing changes when connectivity returns.
- A new contributor can read the codebase, understand the architecture, and make changes (pedagogical goal: generous comments, named functions, plain-language architecture docs).

## Scope Boundaries

- No real-time multi-user collaboration.
- No visualization features (network views, code maps, word clouds).
- No inter-coder reliability metrics.
- No mobile-specific UI.
- No server-side database. All data lives in IndexedDB + Google Drive.
- No server-side API key management. Keys are user-provided and client-stored.

## Key Decisions

- **Full offline with sync later**: Fieldwork contexts have unreliable internet. The app must be fully functional offline with queued sync. This is harder to build than online-only but is core to the value proposition.
- **BYO API keys**: Users provide their own API keys via a settings UI. Keeps hosting costs at zero and avoids the project maintainer absorbing API costs. Keys stored in localStorage.
- **Phase 1 includes working ingestion**: Stubbing all AI would make the tool unusable for its core workflow (getting documents in). Gemini and Reducto integration ships in phase 1. AI codebook and auto-summary are phase 2.
- **Implicit workspace**: User signs in, sees their projects. No workspace creation step. Matches single-user design; avoids unnecessary hierarchy.
- **Linked bilingual coding**: Users can highlight and code in either the original language or the translation. Spans are linked across languages. More complex but essential for multilingual research teams.

## Dependencies / Assumptions

- Google OAuth and Drive API remain freely available for individual developer accounts.
- Gemini API supports Bangla and Hindi audio transcription with speaker diarization at acceptable quality.
- Reducto API handles the document types described (scanned PDFs, handwritten notes, spreadsheets) and returns structured markdown.
- Users are willing to provide their own API keys (acceptable for researcher/academic audience).

## Outstanding Questions

### Resolve Before Planning

(None. All product decisions resolved.)

### Deferred to Planning

- [Affects R3, R4][Needs research] What conflict resolution strategy for Drive sync? Last-write-wins, field-level merge, or manual conflict resolution UI?
- [Affects R2][Technical] What is the Drive folder/file structure? One folder per project? What format are documents stored in on Drive (JSON blobs, individual files)?
- [Affects R8][Needs research] What are Gemini API's actual capabilities for Bangla/Hindi diarization? Need to validate quality.
- [Affects R9][Needs research] What Reducto API features and schema options are available for different file types? Read docs in detail.
- [Affects R16][Technical] How are linked bilingual spans stored and maintained? What happens when the original text is re-processed?
- [Affects R28][Technical] Should API key validation happen on entry (test call) or lazily on first use?
- [Affects R8][Technical] Audio playback integration: how is the waveform rendered and how do timestamped segments link to playback position?
- [Affects R29][Technical] What LLM and prompting strategy for codebook suggestions? Anthropic or OpenAI? Structured output via Pydantic-style validation?

## Design Direction

Three-panel layout (document list | document content | codebook + summary). Clean, minimal, dense without clutter. Linear/Notion adjacent. Serif body type in document reading panes. See attached mockups for reference.

## Next Steps

All product decisions resolved. Ready for structured implementation planning.

`/ce:plan`
