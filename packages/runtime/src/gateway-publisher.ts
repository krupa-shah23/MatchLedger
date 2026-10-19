/**
 * Gateway publisher for orders.submitted (Kafka mode, Phase B).
 * Idempotent producer with acks=all to ensure durability before 202 response.
 * Keyed by accountId to maintain ordering of requests from same account.
 */

import { KafkaJS } from "@confluentinc/kafka-javascript";
import { encodeEnvelope } from "@matchledger/transport";
import { partitionOf } from "@matchledger/common";

const { Kafka } = KafkaJS;

export interface GatewayPublisherConfig {
  brokers: string[];
  riskPartitions: number; // orders.submitted partition count = risk partition count
}

export class GatewayPublisher {
  private producer: any | null = null;
  private kafka: any;
  private riskPartitions: number;

  constructor(config: GatewayPublisherConfig) {
    this.riskPartitions = config.riskPartitions;
    this.kafka = new Kafka({ kafkaJS: { brokers: config.brokers } });

    // Idempotent producer with acks=all
    this.producer = this.kafka.producer({
      "enable.idempotence": true,
      "acks": "all", // Wait for all replicas (most durable)
      kafkaJS: {
        acks: -1, // KafkaJS style for all replicas
      },
    });
  }

  async init(): Promise<void> {
    if (this.producer) {
      await this.producer.connect();
    }
  }

  /**
   * Publish SubmitOrder to orders.submitted topic.
   * Returns success/failure; on failure caller returns 503 Retry-After.
   */
  async publishSubmitOrder(
    orderId: string,
    accountId: string,
    clientOrderId: string,
    payload: unknown
  ): Promise<{ published: boolean; error?: string }> {
    if (!this.producer) {
      return { published: false, error: "Publisher not initialized" };
    }

    try {
      const partition = partitionOf(accountId, this.riskPartitions);

      const submitOrder = {
        type: "SubmitOrder",
        orderId,
        accountId,
        clientOrderId,
        ...(typeof payload === "object" && payload !== null ? payload : {}),
      };

      const envelope = {
        schemaVersion: 1,
        msgId: `${accountId}:${clientOrderId}:${Date.now()}`,
        type: "SubmitOrder",
        payload: submitOrder,
      };

      // Non-transactional send (no transaction coordinator needed)
      // Idempotence + acks=all ensures durability
      await this.producer.send({
        topic: "orders.submitted",
        messages: [
          {
            key: accountId,
            value: encodeEnvelope(envelope),
            partition,
          },
        ],
      });

      return { published: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { published: false, error: msg };
    }
  }

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }
}
