import { bench, describe } from "vitest";
import { OrderBook } from "@matchledger/engine-core";
import type { InstrumentConfig } from "@matchledger/engine-core";

const spec: InstrumentConfig = { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxQuantity: 1000n, maxPrice: 10000n };

describe("R6: Recovery benchmark", () => {
  bench("snapshot + restore", () => {
    const book = new OrderBook(spec);
    const snap = book.snapshot();
    OrderBook.restore(spec, snap);
  });
});
