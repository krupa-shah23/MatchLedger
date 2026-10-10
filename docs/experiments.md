# Experiments

## F1 baseline (Week 2)

The blueprint's E3 is the Week 11 single-process optimisation; these 100 ms runs are a smoke baseline to be repeated with longer runs in Week 4.

Tinybench measurements using the real `@matchledger/engine-core` `Engine`.
Each benchmark rebuilds its input book in tinybench `beforeEach`, excluded from
the measured operation; no optimization was applied.

| Benchmark | Ops/sec | Mean latency |
| --- | ---: | ---: |
| Add resting limit order into 100 existing levels | 1,019,085 | 1,775.8 ns |
| Match one taker against one resting maker | 951,742 | 1,488.5 ns |
| Cancel a resting order | 1,990,195 | 907.27 ns |

Machine: 13th Gen Intel(R) Core(TM) i5-13420H, 15.64 GiB RAM, Microsoft
Windows 11 Home Single Language 10.0.26200, Node v24.18.0. Benchmark used
100 ms measurement and 100 ms warmup per task; samples were 56,312, 67,181,
and 110,222 respectively.

## E3 baseline (Week 3)

The B1 to B7 benchmark harness was added at commit
`73eac0e56a59d77201f672c157f56802ff78f188`. It prints Node version, operating
system, CPU model/count, total memory, date, and a JSON result file at
`packages/benchmarks/results/latest.json`.

The run was **blocked before producing measurements**: the repository remains
in STUB mode and the engine throws `IOC matching is not implemented`. Because
B6 is a real IOC operation, it was not replaced with a no-op or omitted. The
console output therefore contained no valid B1 to B7 table, and no B7 growth
claim is made.

### What this does NOT prove

- no allocation data;
- no tail latency;
- no GC effects;
- no event-loop lag;
- no Kafka or PostgreSQL behavior;
- no production throughput;
- no valid single-run B1 to B7 baseline while IOC is stubbed.

This agent's machine is not necessarily the machine that goes on a resume.
Re-run on your own laptop, plugged in and quiet, before quoting any number.

## Week 4: F2a and F3

### H1

Serialized overspend is exactly zero in every F3 cell; naive overspend is greater than zero in every cell where more than one handler is in flight.

Result:

### H2

With a microtask store delay the two modes have similar throughput (little latency to overlap).

Result:

### H3

With a setImmediate store delay the naive mode shows HIGHER raw throughput than the serialized mode, because it overlaps store latency while the serialized loop pays it per message. If true, that is the honest cost of correctness in this setup, not a failure of the design.

Result:

### H4

In the hot-account cell (accounts = 1), naive overspend is dramatically larger than in the 100-account cell, while serialized throughput changes very little.

Result:

### What these experiments do NOT prove

- single machine;
- simulated in-memory store latency (not a real database);
- no Kafka or Postgres;
- prototype risk logic (BUY cash only);
- one Node process;
- tail latency includes this machine's GC and background load.
## E3 baseline: engine micro-benchmarks (Week 3)
Environment: Node v24.18.0, 12 CPUs, 16.8 GB RAM, 2026-10-10, tinybench (100 ms warmup, 100 ms run), busy dev machine, base commit fecfc43 (working tree had uncommitted Week 3 changes). Single run; repeat on a quiet machine before quoting.

| Case | ops/sec | mean ns |
|---|---|---|
| B1 rest new best level, then cancel | 1,563,215 | 852 |
| B2 rest at existing level, then cancel | 1,974,201 | 659 |
| B3 match one taker against one maker | 1,669,087 | 739 |
| B4 sweep three levels | 840,222 | 1,406 |
| B5 cancel head | 6,780,279 | 243 |
| B5 cancel middle | 6,460,466 | 236 |
| B5 cancel tail | 6,839,568 | 239 |
| B6 IOC with no liquidity | 2,143,895 | 729 |
| B7 insert worst level, 10 live levels | 878,811 | 1,645 |
| B7 insert worst level, 100 live levels | 676,167 | 2,282 |
| B7 insert worst level, 1000 live levels | 418,399 | 3,816 |

Relative margin of error 1-4% per case. B7 slows as live levels grow (array shift is O(n)).

### What this does NOT prove
- Anything about throughput under I/O, journaling, Kafka or Postgres.
- Tail latency or GC behavior (only means are reported).
- Results on other hardware; this is a baseline for later optimization comparison only.
