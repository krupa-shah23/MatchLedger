export type ParseError = {
    readonly rowNumber: number;
    readonly reason: string;
    readonly value?: string;
};
export type CsvRow = readonly string[];
export declare class RecordParser {
    private readonly rows;
    private readonly errors;
    private field;
    private currentRow;
    private inQuotes;
    private rowStarted;
    private cellStarted;
    private rowNumber;
    push(chunk: string | Uint8Array): void;
    finish(): readonly string[][];
    getErrors(): readonly ParseError[];
    private finishCell;
    private finishRow;
}
export declare function parseCsvText(text: string): {
    readonly rows: readonly string[][];
    readonly errors: readonly ParseError[];
};
export declare function parsePriceMinor(raw: string, priceDecimals: number): bigint | undefined;
