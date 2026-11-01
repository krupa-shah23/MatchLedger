/**
 * System routes: invariants, health, shards, recovery, metrics summary, simulator
 */

import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SqlExecutor } from "@matchledger/projections";
import { deserializeRiskState } from "@matchledger/common";
import type { RuntimeFacade } from "../orders/submit.js";
import type { SimulatorDriverState, Scheduler, SubmitPort } from "@matchledger/simulator";
import {
  createSimulatorDriver,
  startSimulator,
  stopSimulator,
} from "@matchledger/simulator";
import { fetchMetricsSummary } from "../system/prom-queries.js";
import { setInvariantOk } from "../metrics.js";
import type { RiskConfig } from "@matchledger/common";
import { serializeRiskState } from "@matchledger/common";
import { recoverRiskPartition } from "@matchledger/risk";

export interface SystemRoutesDeps {
  executor: SqlExecutor;
  facade: RuntimeFacade;
  prometheusUrl?: string;
  isDemo?: boolean;
  chaosEnabled?: boolean;
  instruments?: Array<{ symbol: string; tick?: string; lot?: string; spec?: any }>;
  simulatorState?: { current: SimulatorDriverState | null };
  /**
   * Needed for a real replay on /system/verify-replay for risk-partition
   * streams (risk-snapshot-{partition}). Without it, that route falls back
   * to a checksum-only self-consistency check instead of an actual replay.
   */
  riskConfig?: RiskConfig;
  /** Same HEARTBEAT_MS a shard process is configured with; the stale-shard
   * threshold on /system/shards is 3 intervals of this, not a fixed literal. */
  heartbeatMs?: number;
  simulatorRateCap?: number;
  simulatorTicksPerSec?: number;
  submitSimulatorOrder?: SubmitPort["submitOrder"];
}

const DEFAULT_HEARTBEAT_MS = 5000;
const STALE_INTERVALS = 3;
const PROJECTOR_LAG_RUNNING_THRESHOLD_SEQ = 1000;
const PROJECTOR_LAG_HEALTHY_THRESHOLD_SEQ = 5000;

export async function registerSystemRoutes(app: FastifyInstance, deps: SystemRoutesDeps): Promise<void> {
  // GET /system/invariants - check system invariants
  app.get<{ Querystring: unknown }>(
    "/system/invariants",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const negativeCashResult = await deps.executor.query(
          `SELECT COUNT(*) as negative_count FROM balances_view WHERE (cash - held_cash) < 0`,
          []
        );
        const negativeCashCount = toCount((negativeCashResult.rows[0] as { negative_count?: string | number } | undefined)?.negative_count);

        const negativeSharesResult = await deps.executor.query(
          `SELECT COUNT(*) as negative_count FROM positions_view WHERE (quantity - held_shares) < 0`,
          []
        );
        const negativeSharesCount = toCount((negativeSharesResult.rows[0] as { negative_count?: string | number } | undefined)?.negative_count);

        const noNegativeAvailable = negativeCashCount === 0 && negativeSharesCount === 0;

        // Double-entry ledger: every asset's postings must net to zero across all accounts.
        const unbalancedLedgerAssets = await deps.executor.query(
          `SELECT asset FROM ledger_entries GROUP BY asset HAVING SUM(amount) <> 0`,
          []
        );
        const ledgerZeroSum = unbalancedLedgerAssets.rows.length === 0;

        // Shares are conserved: every SHARES:<symbol> asset's double-entry ledger
        // postings must net to zero across all accounts (deposits are balanced by
        // an @EXTERNAL leg, trades swap quantity between buyer and seller legs -
        // see live-runtime.ts). positions_view is a customer-only operational
        // view (it deliberately excludes @EXTERNAL, same as balances_view does
        // for cash) and is expected to carry a nonzero total once any deposit
        // has happened, so it cannot be the zero-sum check.
        const unbalancedSymbols = await deps.executor.query(
          `SELECT asset FROM ledger_entries WHERE asset LIKE 'SHARES:%' GROUP BY asset HAVING SUM(amount) <> 0`,
          []
        );
        const positionsZeroSum = unbalancedSymbols.rows.length === 0;

        const projectionsEqualRisk = await checkProjectionsEqualRisk(deps.executor);

        const valid = noNegativeAvailable && ledgerZeroSum && positionsZeroSum && projectionsEqualRisk;

        setInvariantOk("no_negative_available", noNegativeAvailable);
        setInvariantOk("ledger_zero_sum", ledgerZeroSum);
        setInvariantOk("positions_zero_sum", positionsZeroSum);
        setInvariantOk("projections_equal_risk", projectionsEqualRisk);

        return reply.code(200).send({
          valid,
          ledgerZeroSum,
          positionsZeroSum,
          noNegativeAvailable,
          projectionsEqualRisk,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Invariant check failed",
          status: 500,
          code: "internal_error",
          detail: "System invariants check failed",
          instance: "/system/invariants",
          requestId: request.id,
        });
      }
    }
  );

  // GET /system/health - health status
  app.get<{ Querystring: unknown }>(
    "/system/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Calculate projector lag: max(journal seq) - checkpoint
        const lagResult = await deps.executor.query(
          `SELECT COALESCE(MAX(j.seq), 0) - COALESCE(MAX(cp.last_seq), 0) as lag
           FROM journal j LEFT JOIN projection_checkpoints cp ON cp.stream_id=j.stream_id`,
          []
        );
        const projectorLagSeq = Math.max(0, parseInt((lagResult.rows[0] as any)?.lag ?? "0", 10));
        const pipelineState = projectorLagSeq < PROJECTOR_LAG_RUNNING_THRESHOLD_SEQ ? "running" : "lagging";

        return reply.code(200).send({
          status: projectorLagSeq < PROJECTOR_LAG_HEALTHY_THRESHOLD_SEQ ? "healthy" : "degraded",
          projectorLagSeq,
          pipelineState,
          ts: new Date().toISOString(),
        });
      } catch (err) {
        return reply.code(503).type("application/problem+json").send({
          type: "about:blank#service_unavailable",
          title: "Service unavailable",
          status: 503,
          code: "service_unavailable",
          detail: "Health check failed",
          instance: "/system/health",
          requestId: request.id,
        });
      }
    }
  );

  // GET /system/shards - shard status with lease, heartbeat, and journal state
  app.get<{ Querystring: unknown }>(
    "/system/shards",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const staleThresholdSeconds = (STALE_INTERVALS * (deps.heartbeatMs ?? DEFAULT_HEARTBEAT_MS)) / 1000;
        const result = await deps.executor.query(
          `SELECT
            l.lease_id,
            l.owner,
            l.epoch,
            l.acquired_at,
            h.last_heartbeat_at,
            h.last_seq,
            h.owned_symbols,
            COALESCE(MAX(s.last_seq), 0) AS snapshot_seq,
            COALESCE(MAX(j.seq), 0) AS journal_seq,
            (
              SELECT (now() - h.last_heartbeat_at) > make_interval(secs => $1)
              FROM shard_heartbeats h2
              WHERE h2.lease_id = l.lease_id
            )::boolean AS is_stale
          FROM shard_leases l
          LEFT JOIN shard_heartbeats h ON l.lease_id = h.lease_id
          LEFT JOIN snapshots s ON s.stream_id = ANY(h.owned_symbols)
          LEFT JOIN journal j ON j.stream_id = ANY(h.owned_symbols) AND j.record_type = 'EVENT'
          GROUP BY l.lease_id, l.owner, l.epoch, l.acquired_at, h.last_heartbeat_at, h.last_seq, h.owned_symbols
          ORDER BY l.lease_id ASC`,
          [staleThresholdSeconds]
        );

        return reply.code(200).send({
          chaosEnabled: deps.isDemo === true && deps.chaosEnabled === true,
          shards: (result.rows as any[]).map((row: any) => ({
            leaseId: row.lease_id,
            owner: row.owner,
            epoch: row.epoch,
            acquiredAt: row.acquired_at,
            lastHeartbeatAt: row.last_heartbeat_at,
            lastSeq: row.last_seq,
            ownedSymbols: row.owned_symbols || [],
            snapshotSeq: row.snapshot_seq,
            journalSeq: row.journal_seq,
            isStale: row.is_stale,
          })),
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Shard status query failed",
          status: 500,
          code: "internal_error",
          detail: "Failed to retrieve shard status",
          instance: "/system/shards",
          requestId: request.id,
        });
      }
    }
  );

  // GET /system/recovery - recovery log history
  app.get<{ Querystring: unknown }>(
    "/system/recovery",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await deps.executor.query(
          `SELECT
            id,
            lease_id,
            started_at,
            completed_at,
            duration_ms,
            snapshot_seq,
            tail_length,
            symbols_recovered,
            created_at
          FROM recovery_log
          ORDER BY completed_at DESC
          LIMIT 100`,
          []
        );

        return reply.code(200).send({
          recoveries: (result.rows as any[]).map((row: any) => ({
            id: row.id,
            leaseId: row.lease_id,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            durationMs: row.duration_ms,
            snapshotSeq: row.snapshot_seq,
            tailLength: row.tail_length,
            symbolsRecovered: row.symbols_recovered || [],
            createdAt: row.created_at,
          })),
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Recovery log query failed",
          status: 500,
          code: "internal_error",
          detail: "Failed to retrieve recovery log",
          instance: "/system/recovery",
          requestId: request.id,
        });
      }
    }
  );

  // GET /system/metrics/summary - aggregate metrics from Prometheus
  app.get<{ Querystring: unknown }>(
    "/system/metrics/summary",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const prometheusUrl = deps.prometheusUrl || "http://localhost:9090";
        const metrics = await fetchMetricsSummary(prometheusUrl);

        const available = metrics.prometheusAvailable;

        return reply.code(200).send({
          available,
          windowSeconds: available ? 60 : null,
          commandsPerSec: metrics.commandsPerSec,
          latencyMs: available
            ? {
                p50: metrics.latencyP50Ms,
                p95: metrics.latencyP95Ms,
                p99: metrics.latencyP99Ms,
              }
            : null,
          queueDepthMax: metrics.queueDepthMax,
          consumerLagMax: metrics.consumerLagMax,
          eventLoopP99Ms: metrics.eventLoopP99Ms,
          byShard: metrics.byShardCommands.map((item: any) => ({
            leaseId: item.shard_id,
            commandsPerSec: item.rate,
          })),
        });
      } catch (err) {
        // Return graceful 200 response even on error
        return reply.code(200).send({
          available: false,
          windowSeconds: null,
          commandsPerSec: null,
          latencyMs: null,
          queueDepthMax: null,
          consumerLagMax: null,
          eventLoopP99Ms: null,
          byShard: [],
        });
      }
    }
  );

  // POST /system/verify-replay - verify journal replay integrity
  app.post<{ Body: { streamId: string } }>(
    "/system/verify-replay",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { streamId } = request.body as any;
        if (!streamId || typeof streamId !== "string") {
          return reply.code(400).type("application/problem+json").send({
            type: "about:blank#validation_failed",
            title: "Invalid request body",
            status: 400,
            code: "validation_failed",
            detail: "streamId is required",
            instance: "/system/verify-replay",
            requestId: request.id,
          });
        }

        // Get the latest snapshot for the stream
        const snapshotResult = await deps.executor.query(
          `SELECT last_seq, state_json, checksum FROM snapshots WHERE stream_id = $1 ORDER BY last_seq DESC LIMIT 1`,
          [streamId]
        );

        if (snapshotResult.rows.length === 0) {
          return reply.code(404).type("application/problem+json").send({
            type: "about:blank#not_found",
            title: "Stream not found",
            status: 404,
            code: "not_found",
            detail: `No snapshots found for stream ${streamId}`,
            instance: "/system/verify-replay",
            requestId: request.id,
          });
        }

        const snapshotRow = snapshotResult.rows[0] as any;
        const snapshotSeq = snapshotRow.last_seq;
        const storedChecksum = snapshotRow.checksum;

        const riskPartitionMatch = /^risk-snapshot-(\d+)$/.exec(streamId);
        if (riskPartitionMatch && deps.riskConfig) {
          // Real replay: a fresh RiskCore, built from scratch by replaying the
          // risk journal's own commands (starting from the newest still-valid
          // snapshot candidate, or genesis if none validates), independent of
          // whatever is currently cached in any running process.
          const partition = Number(riskPartitionMatch[1]);
          const recovered = await recoverRiskPartition({
            sql: { ...deps.executor,
              // Verify independently from genesis, never by trusting the snapshot under inspection.
              query: (sql: string, values: unknown[]) => /FROM snapshots/i.test(sql)
                ? Promise.resolve({ rows: [] }) : deps.executor.query(sql, values),
            } as unknown as Parameters<typeof recoverRiskPartition>[0]["sql"],
            partition,
            upToSeq: Number(snapshotSeq),
            config: deps.riskConfig,
          });
          const freshChecksum = createHash("sha256").update(serializeRiskState(recovered.core.exportState())).digest("hex");

          return reply.code(200).send({
            streamId,
            upToSeq: recovered.lastSeq,
            equal: freshChecksum === storedChecksum && (() => {
              try { return createHash("sha256").update(serializeRiskState(deserializeRiskState(JSON.stringify(snapshotRow.state_json)))).digest("hex") === storedChecksum; }
              catch { return false; }
            })(),
            checksum: freshChecksum,
          });
        }

        // No real replay is wired for this stream type (no riskConfig, or a
        // stream other than a risk partition — the matching-engine book
        // snapshot path has no production writer at all, so there is
        // nothing to replay it against). Fall back to a self-consistency
        // check: does the stored checksum match the stored state it claims
        // to describe. Weaker than a real replay, but still catches raw
        // tampering of either field.
        const snapshotStateJson = JSON.stringify(snapshotRow.state_json);
        const expectedChecksum = createHash("sha256").update(snapshotStateJson).digest("hex");
        const checksumMatch = expectedChecksum === storedChecksum;

        return reply.code(200).send({
          streamId,
          upToSeq: snapshotSeq,
          equal: checksumMatch,
          checksum: expectedChecksum,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Verify replay failed",
          status: 500,
          code: "internal_error",
          detail: "Failed to verify journal replay",
          instance: "/system/verify-replay",
          requestId: request.id,
        });
      }
    }
  );

  // Demo-only endpoints: simulator control
  if (deps.isDemo && deps.simulatorState) {
    // GET /system/simulator - get simulator status
    app.get("/system/simulator", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const state = deps.simulatorState!.current;
        if (!state) {
          return reply.code(200).send({
            running: false,
            sent: 0,
            backedOff: 0,
            symbols: [],
          });
        }

        return reply.code(200).send({
          running: state.running,
          sent: state.counters.sent,
          backedOff: state.counters.backedOff,
          symbols: state.symbols,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Get simulator status failed",
          status: 500,
          code: "internal_error",
          detail: "Failed to get simulator status",
          instance: "/system/simulator",
          requestId: request.id,
        });
      }
    });

    // POST /system/simulator/start - start the simulator
    app.post<{ Body?: { seed?: number } }>("/system/simulator/start", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const requestedSeed = (request.body as { seed?: number } | undefined)?.seed;
        let state = deps.simulatorState!.current;

        // If already running, return success
        if (state && state.running) {
          return reply.code(200).send({
            running: true,
            sent: state.counters.sent,
            backedOff: state.counters.backedOff,
            symbols: state.symbols,
          });
        }

        // Create new driver if not exists
        if (!state) {
          const instrumentMap = new Map<string, any>();
          const referencePriceTicks = new Map<string, bigint>();
          if (deps.instruments) {
            for (const inst of deps.instruments) {
              instrumentMap.set(inst.symbol, inst.spec);
              const reference = deps.riskConfig?.instruments.get(inst.symbol)?.referencePriceTicks;
              if (reference !== undefined && reference > 0n) referencePriceTicks.set(inst.symbol, reference);
            }
          }

          const scheduler: Scheduler = (fn: () => void, intervalMs: number) => {
            const interval = setInterval(fn, intervalMs);
            return () => clearInterval(interval);
          };

          const submitPort: SubmitPort = {
            submitOrder: async (order: any) => {
              if (!deps.submitSimulatorOrder) return 503;
              return deps.submitSimulatorOrder(order);
            },
          };

          state = await createSimulatorDriver({
            seed: requestedSeed ?? Date.now(),
            symbols: instrumentMap.size > 0 ? Array.from(instrumentMap.keys()) : ["AAPL"],
            ratePerSec: deps.simulatorRateCap ?? 10,
            ticksPerSec: deps.simulatorTicksPerSec ?? 10,
            scenario: "steady",
            scheduler,
            submitPort,
            instruments: instrumentMap,
            referencePriceTicks,
          });

          deps.simulatorState!.current = state;
        }

        // Start the simulator
        state = await startSimulator(state);
        deps.simulatorState!.current = state;

        return reply.code(200).send({
          running: true,
          sent: state.counters.sent,
          backedOff: state.counters.backedOff,
          symbols: state.symbols,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Start simulator failed",
          status: 500,
          code: "internal_error",
          detail: "Failed to start simulator",
          instance: "/system/simulator/start",
          requestId: request.id,
        });
      }
    });

    // POST /system/simulator/stop - stop the simulator
    app.post("/system/simulator/stop", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const state = deps.simulatorState!.current;

        if (!state) {
          return reply.code(200).send({
            running: false,
            sent: 0,
            backedOff: 0,
            symbols: [],
          });
        }

        const stoppedState = await stopSimulator(state);
        deps.simulatorState!.current = stoppedState;

        return reply.code(200).send({
          running: false,
          sent: stoppedState.counters.sent,
          backedOff: stoppedState.counters.backedOff,
          symbols: stoppedState.symbols,
        });
      } catch (err) {
        return reply.code(500).type("application/problem+json").send({
          type: "about:blank#internal_error",
          title: "Stop simulator failed",
          status: 500,
          code: "internal_error",
          detail: "Failed to stop simulator",
          instance: "/system/simulator/stop",
          requestId: request.id,
        });
      }
    });
  }
}

function toCount(value: string | number | undefined): number {
  return value === undefined ? 0 : Number(value);
}

/**
 * Compares the DB projections (balances_view/positions_view) against the latest
 * persisted risk-partition snapshots. Each account lives in exactly one risk
 * partition, so aggregating every partition's latest snapshot covers all accounts.
 */
async function checkProjectionsEqualRisk(executor: SqlExecutor): Promise<boolean> {
  const streamsResult = await executor.query(
    `SELECT DISTINCT stream_id FROM snapshots WHERE stream_id LIKE 'risk-snapshot-%'`,
    []
  );
  const streamIds = (streamsResult.rows as Array<{ stream_id: string }>).map((row) => row.stream_id);

  // No persisted risk snapshots (e.g. a fresh deployment or a unit-test harness
  // without a risk journal): there is nothing to compare against, so this
  // invariant cannot be violated.
  if (streamIds.length === 0) {
    return true;
  }

  const riskCash = new Map<string, { cash: bigint; heldCash: bigint }>();
  const riskPositions = new Map<string, Map<string, { quantity: bigint; heldShares: bigint }>>();

  for (const streamId of streamIds) {
    const snapshotResult = await executor.query(
      `SELECT state_json::text as state_text FROM snapshots WHERE stream_id = $1 ORDER BY last_seq DESC LIMIT 1`,
      [streamId]
    );
    const row = snapshotResult.rows[0] as { state_text: string } | undefined;
    if (!row) continue;

    const state = deserializeRiskState(row.state_text);
    for (const account of state.accounts) {
      riskCash.set(account.accountId, { cash: account.cash, heldCash: account.heldCash });
      const bySymbol = new Map<string, { quantity: bigint; heldShares: bigint }>();
      for (const position of account.positions) {
        bySymbol.set(position.symbol, { quantity: position.quantity, heldShares: position.heldShares });
      }
      riskPositions.set(account.accountId, bySymbol);
    }
  }

  const balancesResult = await executor.query(`SELECT account_id, cash, held_cash FROM balances_view`, []);
  const dbCash = new Map<string, { cash: bigint; heldCash: bigint }>();
  for (const row of balancesResult.rows as Array<{ account_id: string; cash: string | number; held_cash: string | number }>) {
    dbCash.set(row.account_id, { cash: BigInt(row.cash), heldCash: BigInt(row.held_cash) });
  }

  const positionsResult = await executor.query(`SELECT account_id, symbol, quantity, held_shares FROM positions_view`, []);
  const dbPositions = new Map<string, Map<string, { quantity: bigint; heldShares: bigint }>>();
  for (const row of positionsResult.rows as Array<{ account_id: string; symbol: string; quantity: string | number; held_shares: string | number }>) {
    const bySymbol = dbPositions.get(row.account_id) ?? new Map<string, { quantity: bigint; heldShares: bigint }>();
    bySymbol.set(row.symbol, { quantity: BigInt(row.quantity), heldShares: BigInt(row.held_shares) });
    dbPositions.set(row.account_id, bySymbol);
  }

  const accountIds = new Set<string>([...riskCash.keys(), ...dbCash.keys()]);
  for (const accountId of accountIds) {
    const risk = riskCash.get(accountId) ?? { cash: 0n, heldCash: 0n };
    const db = dbCash.get(accountId) ?? { cash: 0n, heldCash: 0n };
    if (risk.cash !== db.cash || risk.heldCash !== db.heldCash) {
      return false;
    }

    const riskBySymbol = riskPositions.get(accountId) ?? new Map<string, { quantity: bigint; heldShares: bigint }>();
    const dbBySymbol = dbPositions.get(accountId) ?? new Map<string, { quantity: bigint; heldShares: bigint }>();
    const symbols = new Set<string>([...riskBySymbol.keys(), ...dbBySymbol.keys()]);
    for (const symbol of symbols) {
      const riskPos = riskBySymbol.get(symbol) ?? { quantity: 0n, heldShares: 0n };
      const dbPos = dbBySymbol.get(symbol) ?? { quantity: 0n, heldShares: 0n };
      if (riskPos.quantity !== dbPos.quantity || riskPos.heldShares !== dbPos.heldShares) {
        return false;
      }
    }
  }

  return true;
}
