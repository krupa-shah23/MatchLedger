import type { SqlExecutor } from "@matchledger/journal";
export interface LedgerEntry {
    txId: string;
    legIdx: number;
    accountId: string;
    asset: string;
    amount: number;
    direction: "DEBIT" | "CREDIT";
    refEventId: string;
}
export declare class PgLedgerStore {
    private sql;
    constructor(sql: SqlExecutor);
    appendLedgerEntries(entries: readonly LedgerEntry[]): Promise<void>;
    getBalance(accountId: string, asset: string): Promise<number>;
    verifyZeroSum(): Promise<boolean>;
}
