# Hard Rules for Week 5

- engine-core/src: unchanged (pure, no I/O, no async)
- Timestamps: journaled input via stamped commands, never wall clock in engine
- Idempotency: every command has (accountId, clientOrderId) or equivalent; every handler dedupes
- Money: bigint only; JSON via decimal strings through shared codec
- No Promise.all over same partition; one loop per partition, strictly awaited
- Test rule: no .skip/.only/.todo in shard/test, risk/test, common/test
- Mutations: every test must fail when the code it protects is broken
- Snapshot & recovery: replay stamped commands == live events; deterministic
- No new npm dependencies without approval
