export type CivilDate = {
    readonly year: number;
    readonly month: number;
    readonly day: number;
};
export declare function civilFromDays(days: number | bigint): CivilDate;
export declare function settlementDate(ts: number | bigint, lagDays: number): string;
