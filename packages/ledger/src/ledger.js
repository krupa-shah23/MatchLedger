import { MAX_AMOUNT } from "@matchledger/common";
export const EXTERNAL = "@EXTERNAL";
export const SUSPENSE = "@SUSPENSE";
export class UnbalancedTransactionError extends Error {
    constructor(message = "Transaction legs do not sum to zero per asset") {
        super(message);
        this.name = "UnbalancedTransactionError";
    }
}
export class Ledger {
    ledgerEntries = [];
    txIds = new Set();
    nextSeq = 1;
    post(tx) {
        if (this.txIds.has(tx.txId)) {
            return { posted: false };
        }
        const byAsset = new Map();
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
        const appended = tx.legs.map((leg) => ({
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
    postDeposit(args) {
        const txId = `dep:${args.requestId}`;
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
    postTrade(t, refEventId) {
        const quantity = t.quantity;
        const price = t.price;
        if (quantity <= 0n || price <= 0n) {
            throw new RangeError("Trade amount and quantity must be positive");
        }
        return this.post({
            txId: `trade:${t.tradeId}`,
            refEventId,
            legs: [
                { accountId: t.buyerAccountId, asset: "CASH", amount: -(price * quantity) },
                { accountId: t.sellerAccountId, asset: "CASH", amount: price * quantity },
                { accountId: t.buyerAccountId, asset: `SHARES:${t.symbol}`, amount: quantity },
                { accountId: t.sellerAccountId, asset: `SHARES:${t.symbol}`, amount: -quantity },
            ],
        });
    }
    postAdjustment(args) {
        if (args.amount === 0n) {
            throw new RangeError("Adjustment amount must be non-zero");
        }
        return this.post({
            txId: `adj:${args.adjustmentId}`,
            refEventId: args.refEventId,
            legs: [
                { accountId: args.accountId, asset: args.asset, amount: args.amount },
                { accountId: SUSPENSE, asset: args.asset, amount: -args.amount },
            ],
        });
    }
    reverse(txId) {
        const reversedId = `rev:${txId}`;
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
    balance(accountId, asset) {
        return this.ledgerEntries
            .filter((entry) => entry.accountId === accountId && entry.asset === asset)
            .reduce((sum, entry) => sum + entry.amount, 0n);
    }
    assetTotal(asset) {
        return this.ledgerEntries
            .filter((entry) => entry.asset === asset)
            .reduce((sum, entry) => sum + entry.amount, 0n);
    }
    entries() {
        const snapshot = this.ledgerEntries.map((entry) => Object.freeze({ ...entry }));
        return Object.freeze(snapshot);
    }
    checkInvariants() {
        const issues = [];
        const perAsset = new Map();
        const perTx = new Map();
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
            const txMap = perTx.get(entry.txId) ?? new Map();
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
    validateLeg(leg) {
        if (leg.amount === 0n) {
            throw new RangeError("Ledger amounts must be non-zero");
        }
        if (leg.amount > MAX_AMOUNT || leg.amount < -MAX_AMOUNT) {
            throw new RangeError("Ledger amount exceeds MAX_AMOUNT");
        }
    }
}
