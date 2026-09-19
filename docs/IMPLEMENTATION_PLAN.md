# Implementation plan

## Decisions

- Use Next.js 16 App Router, TypeScript, PostgreSQL/Prisma, and Auth.js Credentials with JWT sessions.
- Operating dates and ISO weeks are computed against the server's `APP_TIME_ZONE`. Browser time is only used as a display aid.
- The Groq Whisper and Groq language-evaluation implementations sit behind a provider interface, keeping the external evaluation result separate from the final score calculation.
- Audio is held temporarily only while the request is being processed and is deleted in a `finally` block. No database model has an audio URL or binary field.
- When a test or training session starts, a snapshot of the sentences, settings, and prompt/provider versions is preserved.

## Phases

1. **Foundation (done, pending runtime verification)**: project setup, the full database model, invitation sign-up, the first admin, sign-in, server-side RBAC, dashboard shell.
2. **Content (done, pending runtime verification)**: calendar view, sentence creation and active-state management, DOCX validation/preview/selective import, global settings, audit logging.
3. **Training (implemented, pending runtime verification)**: session creation and recovery, the state machine, pointer-capture recording, forced timer stop, idempotent submission, retry locking.
4. **Evaluation (implemented)**: the Groq Whisper/GPT-OSS providers, schema validation, deterministic scoring, and separated mock/live integration tests.
5. **Test (implemented, pending database/E2E verification)**: the Saturday and ISO-week restriction, a once-per-week unique lock, a randomised order snapshot, hidden intermediate results, and the completion result.
6. **Analytics (implemented)**: daily and weekly aggregation, provisional and final rankings, tie-break rules, Recharts, and a previous-week comparison.
7. **Hardening (in progress)**: database rate limiting, security headers, and upload signature checks are implemented. Playwright E2E, real database integration, and deployment verification remain.

## Open questions

- The deployment target and the PostgreSQL provider
- Groq free-plan rate limits and Whisper model availability
- Availability and a pinned version for the Groq evaluation model
- The real invitation code and the operating time zone

None of these change the structure of the implementation, so they stay as environment variables for now.

## Phase 2 implementation notes

- DOCX uploads are checked for extension, MIME type, the 5 MB limit, and corruption. The original binary is never stored — only the SHA-256 hash and the parsing result are recorded in `DocumentImport`.
- Preview entries are pinned in the server database and then selected by index, so a confirmation request cannot tamper with the sentence content.
- The monthly calendar is anchored on today in the operating time zone and supports month navigation, date selection, and display of Training progress/achievement and Test results.
- Adding sentences, changing their active state, DOCX preview/import, and settings changes are all written to `AuditLog`.

## Phase 3 implementation notes

- A unique constraint on session per user and operating date restores the existing session on refresh.
- The question order and the settings are fixed at the start, and until a question is passed the server rejects submissions for any position other than the current one.
- Push-to-talk supports both pointer capture and keyboard input, and calls `MediaRecorder.stop()` exactly once when the time limit hits zero.
- A repeated request with the same idempotency key returns the existing evaluation result, and neither the audio binary nor a URL is written to the database or the logs.
- `EVALUATION_MODE=mock` exists only for developing the recording UI and the flow. It does not evaluate the actual speech and does not count as an operational completion.

## Phase 4–7 implementation notes

- Browser recordings are sent to the Groq Whisper transcription API, and word timestamps, transcript match rate, and segment confidence are used to estimate pronunciation, fluency, and completeness scores. The UI states that these are a proxy, not a professional pronunciation assessment.
- The Groq Chat Completions API uses a pinned prompt version and a strict JSON Schema, and the response is validated again with Zod.
- The Test only creates an attempt on a Saturday in the operating time zone, and a weekly unique constraint plus the question order snapshot in the database prevent retakes and reordering.
- The test API does not return scores, answers, or feedback before completion.
- Team rankings fix the 70/30 weekday formula, the 50/25/25 Saturday–Sunday formula, and the achievement-day / test-score / completion-time tie-break rules in both code and unit tests.
- Rate limiting for authentication and speech evaluation uses database buckets, and user deactivation or a role change takes effect from the next protected request via a server-side database check.
