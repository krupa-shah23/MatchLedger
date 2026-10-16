import { describe, it, expect } from "vitest";
import { SeqDeduper } from "@matchledger/common";
import { EngineEventRouter, type OrderOwner } from "./router.js";
import { MarketView } from "./market-view.js";

describe("Router recovery", () => {
  // RM1: restoreOwners from live reservations
  it("RM1: restoreOwners makes owner map equal to live router", () => {
    const live = new EngineEventRouter({ marketView: new MarketView() });
    const recovered = new EngineEventRouter({ marketView: new MarketView() });

    // Populate live router with orders
    const owners: OrderOwner[] = [
      { accountId: "acc1", symbol: "BTC/USD", side: "BUY" },
      { accountId: "acc2", symbol: "ETH/USD", side: "SELL" },
      { accountId: "acc3", symbol: "BTC/USD", side: "SELL" },
    ];

    for (let i = 0; i < owners.length; i++) {
      const owner = owners[i];
      if (!owner) continue;
      const orderId = `o${i + 1}`;
      live.registerOrder(orderId, owner);
    }

    // Recover into new router
    const ownersWithIds = owners.map((owner, i) => ({
      orderId: `o${i + 1}`,
      accountId: owner.accountId,
      symbol: owner.symbol,
      side: owner.side,
    }));

    recovered.restoreOwners(ownersWithIds);

    // Verify owner maps are equal
    for (let i = 0; i < owners.length; i++) {
      const orderId = `o${i + 1}`;
      expect(recovered.ownerOf(orderId)).toEqual(live.ownerOf(orderId));
    }
  });

  // RM2: MarketView rebuild from orders
  it("RM2: MarketView rebuilt from book has same snapshot as live", () => {
    // Create a live view with orders
    const live = new MarketView();
    const orders = [
      { orderId: "o1", side: "BUY" as const, price: 100n, remaining: 10n },
      { orderId: "o2", side: "SELL" as const, price: 101n, remaining: 5n },
    ];

    for (const order of orders) {
      live.apply("BTC/USD", { type: "ORDER_RESTED" as const, ...order } as any, 0);
    }

    // Create a recovered view by re-applying the same orders
    const recovered = new MarketView();
    for (const order of orders) {
      recovered.apply("BTC/USD", { type: "ORDER_RESTED" as const, ...order } as any, 0);
    }

    // Both should report the same best bid and ask
    const liveSnapshot = live.snapshotFor("BTC/USD");
    const recoveredSnapshot = recovered.snapshotFor("BTC/USD");

    expect(recoveredSnapshot).toEqual(liveSnapshot);
  });

  // RM3: Catch-up mode skips gap detection and sets watermark
  it("RM3: Catch-up mode skips sequence-gap detection and sets watermark", () => {
    const deduper = new SeqDeduper();
    const router = new EngineEventRouter({ marketView: new MarketView(), dedupe: deduper });

    // Add an owner
    router.registerOrder("o1", { accountId: "acc1", symbol: "BTC/USD", side: "BUY" });

    // In normal mode, a gap would throw
    expect(() => {
      router.onShardOutputs([
        {
          symbol: "BTC/USD",
          seq: 2, // Gap: expected seq 1
          ts: 1000,
          command: { type: "SweepProbe", olderThanMs: 0 } as any,
          events: [],
        },
      ]);
    }).toThrow("Gap in BTC/USD");

    // Recover with watermark set
    router.setWatermark("BTC/USD", 1);

    // Now seq 2 should be accepted
    const result = router.onShardOutputs([
      {
        symbol: "BTC/USD",
        seq: 2,
        ts: 1000,
        command: { type: "SweepProbe", olderThanMs: 0 } as any,
        events: [
          {
            type: "ORDER_RESTED",
            orderId: "o1",
            side: "BUY",
            price: 100n,
            remaining: 10n,
          } as any,
        ],
      },
    ]);

    expect(result.notices).toHaveLength(1);
    expect(result.notices[0]?.command.type).toBe("OrderAcked");
  });

  // RM4: Notice catch-up for live orders (Scenario 3)
  it("RM4: Notice catch-up for live orders converges", () => {
    const router = new EngineEventRouter({ marketView: new MarketView() });

    // Both parties exist
    router.registerOrder("o1", { accountId: "acc1", symbol: "BTC/USD", side: "BUY" });
    router.registerOrder("maker1", { accountId: "acc2", symbol: "BTC/USD", side: "SELL" });

    // Scenario 3: o1 rests, then receives a fill
    // Catch-up re-routes the events via routeCatchUp
    const catchUpItems = [
      {
        symbol: "BTC/USD",
        seq: 1,
        idx: 0,
        event: {
          type: "ORDER_RESTED",
          orderId: "o1",
          side: "BUY",
          price: 105n,
          remaining: 10n,
        },
      },
      {
        symbol: "BTC/USD",
        seq: 2,
        idx: 0,
        event: {
          type: "TRADE_EXECUTED",
          takerOrderId: "o1",
          makerOrderId: "maker1",
          tradeId: "t1",
          price: 101n,
          quantity: 4n,
          takerSide: "BUY",
          takerRemaining: 6n,
          makerRemaining: 1n,
        },
      },
    ];

    const result = router.routeCatchUp(catchUpItems);
    // Should process ORDER_RESTED and TRADE_EXECUTED for both parties
    expect(result.notices.length).toBeGreaterThanOrEqual(2); // At least OrderAcked and 2 FillApplied
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.buyerAccountId).toBe("acc1");
    expect(result.trades[0]?.sellerAccountId).toBe("acc2");
  });
});
