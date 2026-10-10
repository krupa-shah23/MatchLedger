import type { Side } from "../matching/types.js";

export class SortedPrices {
  private readonly prices: bigint[] = [];
  private readonly descending: boolean;

  public constructor(side: Side) {
    this.descending = side === "SELL";
  }

  public insert(price: bigint): void {
    const position = this.search(price);
    if (position.found) {
      throw new Error(`Price ${price.toString()} already exists`);
    }
    this.prices.splice(position.index, 0, price);
  }

  public remove(price: bigint): void {
    const position = this.search(price);
    if (position.found) {
      this.prices.splice(position.index, 1);
    }
  }

  public best(): bigint | undefined {
    return this.prices[this.prices.length - 1];
  }

  public has(price: bigint): boolean {
    return this.search(price).found;
  }

  public toArray(): bigint[] {
    return this.prices.slice();
  }

  private search(price: bigint): { readonly index: number; readonly found: boolean } {
    let low = 0;
    let high = this.prices.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      const current = this.prices[middle];
      if (current === undefined) {
        throw new Error("Binary search reached an invalid position");
      }
      if (current === price) {
        return { index: middle, found: true };
      }
      const comesBefore = this.descending ? current > price : current < price;
      if (comesBefore) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return { index: low, found: false };
  }
}
