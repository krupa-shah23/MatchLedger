# Standing rules

- Follow `docs/BLUEPRINT.md` (the current checkout's canonical blueprint source is `blueprint.md` until it is moved there).
- `engine-core` has zero runtime dependencies and no `async`/`await`, `Date`, `Math.random`, or `node:*` imports.
- Money is `bigint`, never `number`.
- Use `Map`, not `{}`, for price-keyed maps.
- Use npm workspaces only.
- Pin exact versions; never use `latest` tags.
- After every task, run build, lint, and tests; fix failures before stopping.
- Update `PROGRESS.md` at the end of every task.

## Frontend rules

- UI designs are created in Google Stitch and exported under `web/design/<page-name>/` as HTML, CSS, and screenshots for visual reference only.
- Never ship Stitch-exported HTML directly. Rebuild each design as React 19 + TypeScript components in `web/src`.
- Frontend stack: React Router 7, TanStack Query 5, and one `useSocket` hook. Do not use Redux.
- API money values are decimal strings: format them only for display and never perform floating-point arithmetic. Any UI-derived value, including a reservation estimate, must be labelled as an estimate.
- Every action returning 202 remains pending until its outcome event arrives.
- Derive route guards from the section 3.4 Role column and keep them in the browser-safe common package.

- Fonts are IBM Plex Sans and IBM Plex Mono only; all numbers use tabular numerals.
- No UI element may exist without a backing endpoint in section 5.10.
- Scroll animation uses CSS scroll-driven animation or IntersectionObserver only; do not add an animation library, and respect `prefers-reduced-motion`.
