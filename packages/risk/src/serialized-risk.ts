// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.

import { BoundedQueue } from "@matchledger/common";
import { decide } from "./decide.js";
import type { AsyncAccountStore } from "./account-store.js";
import type { ReserveRequest, ReserveResult, RiskHooks } from "./types.js";

type Message = {
  readonly request: ReserveRequest;
  readonly resolve: (result: ReserveResult) => void;
  readonly reject: (error: unknown) => void;
};

export class SerializedRisk {
  private readonly queue: BoundedQueue<Message>;
  private loopDone!: Promise<void>;

  public constructor(private readonly store: AsyncAccountStore, options: { readonly queueCapacity: number; readonly hooks?: RiskHooks }) {
    this.queue = new BoundedQueue<Message>(options.queueCapacity);
    this.loopDone = this.loop(options.hooks);
  }

  public submit(request: ReserveRequest): Promise<ReserveResult> {
    return new Promise((resolve, reject) => {
      const enqueued = this.queue.tryEnqueue({ request, resolve, reject });
      if (!enqueued) reject(new Error("SerializedRisk queue full"));
    });
  }

  public stop(): Promise<void> {
    this.queue.close();
    return this.loopDone;
  }

  private async loop(hooks?: RiskHooks): Promise<void> {
    try {
      for (;;) {
        const msg = await this.queue.dequeue();
        if (msg === undefined) break;
        try {
          hooks?.onHandlerStart?.(msg.request);
          const acct = await this.store.read(msg.request.accountId);
          const { result, next } = decide(acct, msg.request);
          if (next) await this.store.write(msg.request.accountId, next);
          hooks?.onHandlerEnd?.(msg.request);
          msg.resolve(result);
        } catch (error: unknown) {
          msg.reject(error);
          throw error;
        }
      }
    } catch (error: unknown) {
      this.queue.close();
      for (const msg of this.queue.drainSync(this.queue.size)) {
        msg.reject(error);
      }
    }
  }

  public readonly state = "RUNNING" as const;
  public get done(): Promise<void> { return this.loopDone; }
}
