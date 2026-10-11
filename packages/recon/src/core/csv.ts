export type ParseError = {
  readonly rowNumber: number;
  readonly reason: string;
  readonly value?: string;
};

export type CsvRow = readonly string[];

export class RecordParser {
  private readonly rows: string[][] = [];
  private readonly errors: ParseError[] = [];
  private field = "";
  private currentRow: string[] = [];
  private inQuotes = false;
  private rowStarted = false;
  private rowNumber = 1;

  public push(chunk: string | Uint8Array): void {
    const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === "\r") {
        if (text[index + 1] === "\n") {
          index += 1;
        }
        this.finishCell();
        this.finishRow();
        continue;
      }
      if (char === "\n") {
        this.finishCell();
        this.finishRow();
        continue;
      }
      if (char === '"') {
        if (this.inQuotes && text[index + 1] === '"') {
          this.field += '"';
          index += 1;
          continue;
        }
        this.inQuotes = !this.inQuotes;
        this.rowStarted = true;
        continue;
      }
      if (char === "," && !this.inQuotes) {
        this.finishCell();
        continue;
      }
      this.field += char;
      this.rowStarted = true;
    }
  }

  public finish(): readonly string[][] {
    if (this.inQuotes) {
      this.errors.push({ rowNumber: this.rowNumber, reason: "unterminated quoted field" });
      this.inQuotes = false;
    }
    if (this.rowStarted || this.currentRow.length > 0 || this.field.length > 0) {
      this.finishCell();
      this.finishRow();
    }
    return this.rows;
  }

  public getErrors(): readonly ParseError[] {
    return this.errors;
  }

  private finishCell(): void {
    this.currentRow.push(this.field);
    this.field = "";
  }

  private finishRow(): void {
    if (!this.rowStarted && this.currentRow.length === 0 && this.field.length === 0) {
      return;
    }
    const row = [...this.currentRow];
    if (row.length > 0 || this.field.length > 0) {
      this.rows.push(row);
    }
    this.rowNumber += 1;
    this.currentRow = [];
    this.field = "";
    this.inQuotes = false;
    this.rowStarted = false;
  }
}

export function parseCsvText(text: string): { readonly rows: readonly string[][]; readonly errors: readonly ParseError[] } {
  const parser = new RecordParser();
  parser.push(text.replace(/^\uFEFF/, ""));
  const rows = parser.finish();
  return { rows, errors: parser.getErrors() };
}

export function parsePriceMinor(raw: string, priceDecimals: number): bigint | undefined {
  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }
  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.replace(/^[-+]/, "");
  if (!/^(\d+)(\.\d+)?$/.test(unsigned)) {
    return undefined;
  }
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > priceDecimals) {
    return undefined;
  }
  const scaled = BigInt(whole || "0") * 10n ** BigInt(priceDecimals) + BigInt((fraction + "0".repeat(priceDecimals - fraction.length)).padEnd(priceDecimals, "0"));
  return scaled * sign;
}
