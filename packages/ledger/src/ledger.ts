import { MAX_AMOUNT } from "@matchledger/common";
import { txIdForDeposit, txIdForTrade, txIdForAdjustment, txIdForReversal } from "./tx-id.js";

export type LedgerEntry = {
  readonly txId: string;
  readonly seq: number;
  readonly accountId: string;
  readonly asset: string;
  readonly amount: bigint;
  readonly direction: "DEBIT" | "CREDIT";
  readonly refEventId: string;
};

export type LedgerTx = {
  readonly txId: string;
  readonly refEventId: string;
  readonly legs: readonly { readonly accountId: string; readonly asset: string; readonly amount: bigint }[];
};

export type TradePosting = {
  tradeId: string;
  symbol: string;
  price: bigint;
  quantity: bigint;
  buyerAccountId: string;
  sellerAccountId: string;
  ts?: number;
};

export const EXTERNAL = "@EXTERNAL";
export const SUSPENSE = "@SUSPENSE";

export class UnbalancedTransactionError extends Error {
  public constructor(message = "Transaction legs do not sum to zero per asset") {
    super(message);
    this.name = "UnbalancedTransactionError";
  }
}

export class RestoreError extends Error {
  public constructor(message = "Failed to restore ledger from entries") {
    super(message);
    this.name = "RestoreError";
  }
}

export class Ledger {
  private readonly ledgerEntries: LedgerEntry[] = [];
  private readonly txIds = new Set<string>();
  private nextSeq = 1;

  public static restore(entries: readonly LedgerEntry[]): Ledger {
    const ledger = new Ledger();
    if (entries.length === 0) return ledger;

    const byTx = new Map<string, LedgerEntry[]>();
    for (const entry of entries) {
      if (!byTx.has(entry.txId)) byTx.set(entry.txId, []);
      byTx.get(entry.txId)!.push(entry);
    }

    const sortedTxs = Array.from(byTx.entries()).sort((a, b) => {
      const minSeqA = Math.min(...a[1].map((e) => e.seq));
      const minSeqB = Math.min(...b[1].map((e) => e.seq));
      return minSeqA - minSeqB;
    });

    for (const [txId, txEntries] of sortedTxs) {
      const legs = txEntries.map((e) => ({
        accountId: e.accountId,
        asset: e.asset,
        amount: e.amount,
      }));

      const byAsset = new Map<string, bigint>();
      for (const leg of legs) {
        const total = byAsset.get(leg.asset) ?? 0n;
        byAsset.set(leg.asset, total + leg.amount);
      }
      for (const [asset, total] of byAsset.entries()) {
        if (total !== 0n) {
          throw new RestoreError(`Unbalanced asset ${asset} in tx ${txId}: ${total.toString()}`);
        }
      }

      const legIndices = new Set(txEntries.map((e) => {
        const match = e.txId.match(/^([^:]+):(.*)$/);
        if (!match) return 0;
        const prefix = match[1];
        const legIdx = prefix === "trade" ? txEntries.indexOf(e) : 0;
        return legIdx;
      }));
      const maxIdx = Math.max(...Array.from(legIndices));
      for (let i = 0; i <= maxIdx; i++) {
        if (!legIndices.has(i)) {
          throw new RestoreError(`Missing leg_idx ${i} in tx ${txId}`);
        }
      }

      ledger.ledgerEntries.push(
        ...legs.map((leg) => ({
          txId,
          seq: ledger.nextSeq++,
          accountId: leg.accountId,
          asset: leg.asset,
          amount: leg.amount,
          direction: (leg.amount < 0n ? "DEBIT" : "CREDIT") as "DEBIT" | "CREDIT",
          refEventId: txEntries[0]!.refEventId,
        })),
      );
      ledger.txIds.add(txId);
    }

    const issues = ledger.checkInvariants();
    if (issues.length > 0) {
      throw new RestoreError(`Invariant violations: ${issues.join(", ")}`);
    }
    return ledger;
  }

  public post(tx: LedgerTx): { posted: boolean } {
    if (this.txIds.has(tx.txId)) {
      return { posted: false };
    }

    const byAsset = new Map<string, bigint>();

    for (const leg of tx.legs) {
      this.validateLeg(leg);
      const total = byAsset.get(leg.asset) ?? 0n;
      byAsset.set(leg.asset, total + leg.amount);
    }

    for (const [asset, total] of byAsset.entries()) {
      if (total !== 0n) {
        throw new UnbalancedTransactionError(`Unbalanced asset ${asset}: ${total.toString()}`);
      }
    }

    const appended: LedgerEntry[] = tx.legs.map((leg) => ({
      txId: tx.txId,
      seq: this.nextSeq++,
      accountId: leg.accountId,
      asset: leg.asset,
      amount: leg.amount,
      direction: leg.amount < 0n ? "DEBIT" : "CREDIT",
      refEventId: tx.refEventId,
    }));

    this.ledgerEntries.push(...appended);
    this.txIds.add(tx.txId);
    return { posted: true };
  }

  public postDeposit(args: {
    accountId: string;
    asset: string;
    amount: bigint;
    requestId: string;
    refEventId: string;
  }): { posted: boolean } {
    const txId = txIdForDeposit(args.requestId);
    const amount = args.amount;
    if (amount === 0n || amount > MAX_AMOUNT || amount < -MAX_AMOUNT) {
      throw new RangeError("Deposit amount must be non-zero and within MAX_AMOUNT bounds");
    }

    return this.post({
      txId,
      refEventId: args.refEventId,
      legs: [
        { accountId: args.accountId, asset: args.asset, amount },
        { accountId: EXTERNAL, asset: args.asset, amount: -amount },
      ],
    });
  }

  public postTrade(t: TradePosting, refEventId: string): { posted: boolean } {
    const quantity = t.quantity;
    const price = t.price;
    if (quantity <= 0n || price <= 0n) {
      throw new RangeError("Trade amount and quantity must be positive");
    }

    return this.post({
      txId: txIdForTrade(t.tradeId),
      refEventId,
      legs: [
        { accountId: t.buyerAccountId, asset: "CASH", amount: -(price * quantity) },
        { accountId: t.sellerAccountId, asset: "CASH", amount: price * quantity },
        { accountId: t.buyerAccountId, asset: `SHARES:${t.symbol}`, amount: quantity },
        { accountId: t.sellerAccountId, asset: `SHARES:${t.symbol}`, amount: -quantity },
      ],
    });
  }

  public postAdjustment(args: { adjustmentId: string; accountId: string; asset: string; amount: bigint; refEventId: string }): { posted: boolean } {
    if (args.amount === 0n) {
      throw new RangeError("Adjustment amount must be non-zero");
    }
    return this.post({
      txId: txIdForAdjustment(args.adjustmentId),
      refEventId: args.refEventId,
      legs: [
        { accountId: args.accountId, asset: args.asset, amount: args.amount },
        { accountId: SUSPENSE, asset: args.asset, amount: -args.amount },
      ],
    });
  }

  public reverse(txId: string): { posted: boolean } {
    const reversedId = txIdForReversal(txId);
    if (this.txIds.has(reversedId)) {
      return { posted: false };
    }
    if (!this.txIds.has(txId)) {
      throw new Error(`Unknown txId: ${txId}`);
    }

    const original = this.ledgerEntries.filter((entry) => entry.txId === txId);
    return this.post({
      txId: reversedId,
      refEventId: reversedId,
      legs: original.map((entry) => ({
        accountId: entry.accountId,
        asset: entry.asset,
        amount: -entry.amount,
      })),
    });
  }

  public balance(accountId: string, asset: string): bigint {
    return this.ledgerEntries
      .filter((entry) => entry.accountId === accountId && entry.asset === asset)
      .reduce((sum, entry) => sum + entry.amount, 0n);
  }

  public assetTotal(asset: string): bigint {
    return this.ledgerEntries
      .filter((entry) => entry.asset === asset)
      .reduce((sum, entry) => sum + entry.amount, 0n);
  }

  public entries(): readonly LedgerEntry[] {
    const snapshot = this.ledgerEntries.map((entry) => Object.freeze({ ...entry }));
    return Object.freeze(snapshot) as readonly LedgerEntry[];
  }

  public checkInvariants(): string[] {
    const issues: string[] = [];
    const perAsset = new Map<string, bigint>();
    const perTx = new Map<string, Map<string, bigint>>();

    for (const entry of this.ledgerEntries) {
      if (entry.amount === 0n) {
        issues.push(`zero-amount:${entry.txId}`);
      }
      if (entry.amount > MAX_AMOUNT || entry.amount < -MAX_AMOUNT) {
        issues.push(`amount-bounds:${entry.txId}:${entry.amount.toString()}`);
      }
      if (entry.direction === "DEBIT" && entry.amount >= 0n) {
        issues.push(`direction-debit:${entry.txId}:${entry.amount.toString()}`);
      }
      if (entry.direction === "CREDIT" && entry.amount <= 0n) {
        issues.push(`direction-credit:${entry.txId}:${entry.amount.toString()}`);
      }

      const assetTotal = perAsset.get(entry.asset) ?? 0n;
      perAsset.set(entry.asset, assetTotal + entry.amount);

      const txMap = perTx.get(entry.txId) ?? new Map<string, bigint>();
      txMap.set(entry.asset, (txMap.get(entry.asset) ?? 0n) + entry.amount);
      perTx.set(entry.txId, txMap);
    }

    for (const [asset, total] of perAsset.entries()) {
      if (total !== 0n) {
        issues.push(`asset-total:${asset}:${total.toString()}`);
      }
    }

    for (const [txId, txMap] of perTx.entries()) {
      for (const [asset, total] of txMap.entries()) {
        if (total !== 0n) {
          issues.push(`tx-total:${txId}:${asset}:${total.toString()}`);
        }
      }
    }

    return issues;
  }

  private validateLeg(leg: { accountId: string; asset: string; amount: bigint }): void {
    if (leg.amount === 0n) {
      throw new RangeError("Ledger amounts must be non-zero");
    }
    if (leg.amount > MAX_AMOUNT || leg.amount < -MAX_AMOUNT) {
      throw new RangeError("Ledger amount exceeds MAX_AMOUNT");
    }
  }
}
