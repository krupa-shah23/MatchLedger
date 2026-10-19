# E2 Scaling Experiment: Sharding Under Contention

## Environment

**Hardware:**
- K shard containers: CPU limit = 1 core each (no oversubscription)
- Broker (Kafka 4.2, single KRaft node): Pinned to separate core
- Postgres 18: Pinned to separate core
- Order generator: Pinned to separate core
- Network: Local docker bridge (no remote latency)

**Configuration:**
- Shards: K ∈ {1, 2, 4}
- Symbols: 8 total, uniform 2 per partition (4 partitions)
- Order batch size: 100 orders
- Repetitions: 3 (warm-up discarded, report median and range)

**Workload:**
1. Uniform load: 8 symbols equally (baseline)
2. Hot-symbol load: 80% of orders go to 1 symbol, 20% to others (contention stress test)

## Hypothesis

**Prediction before the run:**

"Throughput grows roughly linearly with shard count (K) up to the bottleneck:

- K=1: ~X orders/sec (baseline, single shard owns all partitions)
- K=2: ~2X orders/sec (each shard gets 2 partitions, parallelism doubles)
- K=4: ~4X orders/sec (each shard gets 1 partition, full parallelism, until resource limits hit)

The bottleneck is Postgres commit time (all writes serialized through single instance). Once K reaches ~2-3, Kafka producer throughput is sufficient; further increases hit write amplification from replication and journal I/O.

For the hot-symbol load:
- Single-book cannot be split across shards (single writer per symbol)
- Shard owning the hot symbol saturates at K=1 throughput
- Other shards remain idle (2-4x headroom unused)
- Total system throughput = min(hot shard, other shards), capped by hot symbol

**Quantitative expectation:**
- Uniform: K=2 achieves ~1.8-2.0x K=1 (accounting for lock contention overhead)
- Uniform: K=4 achieves ~3.5-3.8x K=1 (Postgres is the bottleneck)
- Hot: K=2 achieves ~1.1-1.2x K=1 (hot shard still owns everything)
- Hot: K=4 achieves ~1.0-1.1x K=1 (no improvement, single book is the limit)

This test does NOT prove production-scale behavior; shared resources (localhost, one machine) create artifacts. It DOES prove whether our architecture can use parallelism when available and where the first bottleneck appears."

## Results

(Generated from e2-scaling.mjs output)

### Uniform Load

| K | Orders/sec | p50 lat (ms) | p95 lat (ms) | p99 lat (ms) | Event-loop delay (ms) | Consumer lag (cmds) | Postgres commit (ms) |
|---|-----------|------------|------------|------------|---------------------|-----------------|------------------|
| 1 | -         | -          | -          | -          | -                   | -               | -                |
| 2 | -         | -          | -          | -          | -                   | -               | -                |
| 4 | -         | -          | -          | -          | -                   | -               | -                |

### Hot-Symbol Load (80% to 1 symbol)

| K | Orders/sec | p50 lat (ms) | p95 lat (ms) | p99 lat (ms) | Event-loop delay (ms) | Consumer lag (cmds) | Postgres commit (ms) |
|---|-----------|------------|------------|------------|---------------------|-----------------|------------------|
| 1 | -         | -          | -          | -          | -                   | -               | -                |
| 2 | -         | -          | -          | -          | -                   | -               | -                |
| 4 | -         | -          | -          | -          | -                   | -               | -                |

## Deviations

(Record surprises: predictions that did not match results, and why)

- 

## Proves / Does Not Prove

(To be filled in after results)

**Proves:**
- 

**Does NOT prove:**
- Single-machine artifacts (shared memory, cache coherency, single I/O controller) do not reproduce production constraints
- Network latency effects (geo-distributed shards)
- Larger shard counts (K > 4) and their resource scaling
- Long-running stability (test runs ~1 minute per config, not hours)
- Failure recovery under load (chaos scenarios isolated)
