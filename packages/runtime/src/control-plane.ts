/**
 * Control-plane consumer for engine.events (Kafka mode, Week 10).
 * Skip a ShardOutput if seq <= router watermark for its symbol.
 * Otherwise call EngineEventRouter.onShardOutputs and commit the Kafka offset.
 */

import { PartitionConsumer, decodeEnvelope } from "@matchledger/transport";
import type { ConsumerMessage } from "@matchledger/transport";
import type { ShardOutput } from "@matchledger/common";

export interface ControlPlaneConsumerConfig {
  consumer: PartitionConsumer;
  brokers: string[];
  router: any; // EngineEventRouter
  watermarks: Map<string, number>; // Per-symbol router watermarks
}

/**
 * Start consuming engine.events and routing outputs.
 * Watermark-skip prevents reprocessing already-applied events.
 */
export async function startControlPlaneConsumer(config: ControlPlaneConsumerConfig): Promise<void> {
  const { consumer, router, watermarks } = config;

  await consumer.run(
    async (msg: ConsumerMessage) => {
      try {
        // Decode the message
        const decoded = decodeEnvelope(msg.value.toString());
        const output = decoded.payload as ShardOutput;

        const symbol = output.symbol;
        const currentWatermark = watermarks.get(symbol) ?? 0;

        // Skip if already processed (at-least-once semantics + watermark)
        if (output.seq <= currentWatermark) {
          // Offset will be committed below
          return;
        }

        // Process the output through the router
        await router.onShardOutputs([output]);

        // Update watermark after successful processing
        watermarks.set(symbol, output.seq);
      } catch (error) {
        console.error("[control-plane] Error processing engine.events:", error);
        throw error;
      }
    },
    (error: any) => {
      console.error("[control-plane] Consumer error:", error);
      throw error;
    }
  );
}

/**
 * Recover control plane watermarks from persisted state.
 * Returns a map of symbol -> last processed seq.
 */
export function recoverWatermarks(routerState: any): Map<string, number> {
  const watermarks = new Map<string, number>();

  // Load watermarks from router state or journals
  // This is a placeholder; real implementation would read from persisted watermarks
  for (const [symbol, state] of Object.entries(routerState ?? {})) {
    watermarks.set(symbol, (state as any).seq ?? 0);
  }

  return watermarks;
}
