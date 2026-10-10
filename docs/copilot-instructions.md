Create .github/copilot-instructions.md with these standing rules for this repository, and nothing else:

- Spec: docs/BLUEPRINT.md and docs/week2-plan.md are the source of truth. If a request conflicts with them, say so before coding.
- packages/engine-core: zero runtime dependencies, synchronous only. Forbidden inside packages/engine-core/src: async, await, Promise, Date, performance, Math.random, setTimeout/setInterval/setImmediate, process, crypto, fetch, any node: import, any npm import. Test files (*.test.ts) may use fast-check and vitest.
- Money, price and quantity are bigint (ticks and lots). Never number. Never mix number and bigint in one expression. Never use JSON.stringify on a bigint without a replacer.
- Use Map, never a plain object, for any collection keyed by price or id. Never rely on object key order.
- Time and ids are inputs to the engine, never generated inside it. Counters (engineSeq, tradeId) live in engine state.
- A rejected command must not change engine state (validate everything first, then mutate).
- Do not export mutable internals; expose read-only views.
- Exact dependency versions only; no new dependencies without asking.
- After every task run: npm run build, npm run lint, npm run check:boundaries, npm test, and fix failures before finishing.
- Update PROGRESS.md at the end of every task (what, how, tests, status) and list any deviation from the spec.