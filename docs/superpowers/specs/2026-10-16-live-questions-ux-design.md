# Live Questions UX Design

## Goal

Make the public live-questions experience usable during a presentation without manual page refreshes, while making question popularity visible through a compact blue like control.

## Scope

- Public question portal visual refresh to the event landing page's light visual language.
- Reversible one-vote-per-participant interaction with optimistic feedback.
- Automatic question and vote refresh on the public portal and internal moderation panel.
- Persistent display of the current public code, URL, and QR after generation.
- Simplification of the moderation card by removing topic assignment controls from the live workflow.
- Regeneration remains available as an explicit secondary action.

## Non-goals

- No WebSocket or Supabase Realtime infrastructure in this iteration.
- No change to the existing participant identity or one-vote-per-participant constraint.
- No removal of topic data from the database or exports; only remove the live-card controls.
- No redesign of the protected admin visual system beyond the targeted question panel changes.

## User Experience

### Public portal

- Use the event landing page light mode: warm cream background, white/translucent cards, dark text, soft borders, and blue accent.
- Each published question displays its text, a thumb-up icon button, and the vote count beside it.
- The button has no visible text. It must expose an accessible dynamic label and tooltip/title:
  - `Votar pregunta` when inactive.
  - `Quitar voto` when active.
- The active state uses the blue accent and a filled icon; the inactive state uses an outline icon.
- A short scale/bounce animation confirms a successful toggle without disrupting the list.
- The first press adds the participant's vote; pressing again removes it.
- Failed mutations roll back optimistic count/state and expose a concise inline error.
- The public list refreshes automatically every three seconds so approved questions and vote counts appear without manual refresh.

### Internal panel

- The moderation list refreshes automatically every three seconds.
- A newly submitted question appears in the pending queue without manual refresh.
- Once approved, the public portal discovers it during its next refresh interval.
- Remove topic selection and the `Asignar` action from the live moderation card. Preserve topic data and backend capabilities for other workflows and exports.
- Keep primary moderation actions compact in one row when the viewport allows it. Responsive wrapping is allowed on narrow screens to prevent overflow.
- Keep answer content readable below the action row when an answer exists.
- After a code is generated, always render the current code, public URL, and QR from the persisted question session.
- Keep `Regenerate code` as a secondary, explicit action for invalidation or recovery scenarios; it must not run on page refresh.

## Data and API Behavior

- Preserve the existing composite uniqueness constraint for `(questionId, participantId)`.
- Extend the public question view model with `hasVoted` for the current participant.
- The public page resolves the participant from the existing session cookie and computes `hasVoted` while loading public questions.
- The vote server action validates the session and participant, then inserts when inactive or deletes when active.
- The operation remains idempotent for repeated requests and cannot affect another participant's vote.
- Polling uses the existing server-rendered data path and `router.refresh()`; it must clean up its interval on unmount.

## Error and Loading States

- Disable the like button while its mutation is pending to prevent duplicate clicks.
- Preserve the previous visual state if the mutation fails.
- Do not show a blocking modal for a vote failure; render a small accessible error near the question.
- Polling failures must not blank existing content or interrupt the presentation. The next interval retries.
- Code and QR rendering must handle a missing session gracefully rather than showing stale generated data.

## Accessibility and Responsive Behavior

- Use a real button with keyboard focus, visible focus styling, and an accessible name.
- Do not communicate the active vote state through color alone; use the filled/outline icon state and label.
- Ensure the action row wraps safely on mobile.
- Keep the public page readable at narrow widths and avoid horizontal scrolling.
- Preserve the existing checkbox and dropdown behavior outside this scope.

## Verification

- Unit-test vote toggle behavior for add, remove, duplicate protection, and participant isolation.
- Unit-test public view mapping for `hasVoted` true and false.
- Verify polling cleanup and refresh behavior at the component level where existing test patterns support it.
- Verify the public page and internal panel update without manual reload in a local browser session.
- Verify the code, URL, and QR remain visible after navigating away and returning to the question panel.
- Run the project's typecheck, lint, focused question tests, and build checks.

## Open Decisions Resolved

- Like icon: thumb-up.
- Accent: blue.
- Vote behavior: reversible toggle.
- Refresh strategy: three-second polling for this iteration.
- Topic assignment controls: removed from the live moderation card, backend data retained.
