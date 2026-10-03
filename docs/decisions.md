# Decision log`n`n## Decision 18 — fast-check`n### Context`nCore invariants need reproducible generated cases.`n### Options considered`nExamples only; custom harness; fast-check.`n### Choice`nUse fast-check with Vitest.`n### Trade-offs`nMore suite time, but shrinking and replay.`n`n## Decision 19 — breaker folder`n### Context`nBreaker transitions replay with matching.`n### Options considered`nSeparate package; engine-core folder.`n### Choice`n`engine-core/src/breaker`.`n### Trade-offs`nImplementation, not package boundary.`n`n## Decision 20 — Node and TypeScript`n### Context`nNeed a single writer and shared contracts.`n### Options considered`nNode/TS; Java; systems language.`n### Choice`nNode 24 and TypeScript 6.`n### Trade-offs`nGC tail latency and no shared-memory parallelism.`n`n## Decision 22 — TypeScript pin`n### Context`nTS7 has toolchain risk.`n### Options considered`nTS7; TS6.`n### Choice`nPin 6.0.3.`n### Trade-offs`nDefer TS7 features.`n
## Decision 23 — Google Stitch as a UI reference, React as the product

### Context
The dashboard needs a credible visual design without sacrificing the typed, testable frontend architecture in the blueprint.

### Options considered
- Build screens directly from an ad-hoc React layout.
- Ship the HTML/CSS exported by Google Stitch.
- Use Stitch exports as visual references and rebuild the screens in React.

### Choice
Design in Google Stitch and save each export under `web/design/<page-name>/`. Treat the exported HTML, CSS, and screenshots as reference material only; rebuild each screen as React 19 + TypeScript components in `web/src`, using React Router 7, TanStack Query 5, and the single `useSocket` hook.

### Trade-offs
This introduces a translation step and visual-regression responsibility, but avoids shipping static export code, preserves routing/data boundaries, and keeps UI behavior aligned with the asynchronous API contract. Decimal-string money remains display-only; estimates are labelled; 202 responses stay pending until an outcome event arrives. Shared route guards live in `common` so frontend access rules track the section 3.4 role matrix.

## Decision 24 — public registration is demo-only and TRADER-only

### Context
The demo needs a low-friction path for reviewers to experience the trader flow, without exposing account creation or role escalation as production behavior.

### Options considered
- Public registration in every deployment with role selection.
- No public registration; seeded accounts only.
- Registration only in the demo profile, creating a fixed TRADER setup.

### Choice
`POST /auth/register` is public only in the demo profile. It creates a TRADER user, one account, and a fixed simulated ledger deposit. The role is never accepted from the request.

### Trade-offs
This improves demo usability but is deliberately not a production identity design. It cannot create privileged users and is rate-limited; production would use managed identity, verification, funding controls, and operator-controlled roles.
