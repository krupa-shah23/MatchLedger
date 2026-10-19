/**
 * Single-flight deduplication for concurrent identical requests
 * Key-based promise coalescing: concurrent requests with the same key share one execution
 */

export class SingleFlight<T> {
  private inflight: Map<string, Promise<T>> = new Map();

  /**
   * Execute work, coalescing concurrent requests with the same key.
   * On settle (success or failure), entry is removed so retries run independently.
   */
  async run(key: string, work: () => Promise<T>): Promise<T> {
    // Check if already in-flight
    if (this.inflight.has(key)) {
      return this.inflight.get(key)!;
    }

    // Start execution and store promise
    const promise = work()
      .finally(() => {
        // Always remove on settle (success or failure)
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);

    return promise;
  }
}
