export type BreakType = "MISSING_EXTERNAL" | "MISSING_INTERNAL" | "QUANTITY_MISMATCH" | "PRICE_MISMATCH" | "SETTLEMENT_MISMATCH" | "DUPLICATE" | "LATE";

export type InternalTradeRecord = Readonly<{
  readonly tradeId: string;
  readonly symbol: string;
  readonly quantity: bigint;
  readonly price: bigint;
  readonly buyerAccountId: string;
  readonly sellerAccountId: string;
  readonly ts: number;
}>;

export type StatementRow = Readonly<{
  readonly tradeId: string;
  readonly symbol: string;
  readonly quantity: string;
  readonly price: string;
  readonly tradeTs: string;
  readonly settlementDate: string;
}>;

export type BreakDefinition = Readonly<{
  readonly tradeId: string;
  readonly type: BreakType;
  readonly count?: number;
  readonly internalQuantity?: bigint;
  readonly externalQuantity?: bigint;
  readonly internalPrice?: bigint;
  readonly externalPrice?: bigint;
  readonly internalSettlement?: string;
  readonly externalSettlement?: string;
  readonly internalTs?: number;
  readonly externalTs?: number;
}>;

export function classify(args: {
  readonly cutoffTs: number;
  readonly priceDecimals: number;
  readonly settlementLagDays: number;
  readonly internalTrades: readonly InternalTradeRecord[];
  readonly statementRows: readonly StatementRow[];
}): readonly BreakDefinition[] {
  const { cutoffTs, settlementLagDays, internalTrades, statementRows } = args;
  const internalById = new Map<string, InternalTradeRecord>();
  for (const trade of internalTrades) {
    internalById.set(trade.tradeId, trade);
  }

  const externalById = new Map<string, StatementRow[]>();
  for (const row of statementRows) {
    const list = externalById.get(row.tradeId) ?? [];
    list.push(row);
    externalById.set(row.tradeId, list);
  }

  const breaks: BreakDefinition[] = [];

  for (const [tradeId, internalTrade] of [...internalById.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const rows = externalById.get(tradeId) ?? [];
    if (rows.length === 0) {
      breaks.push({ tradeId, type: "MISSING_EXTERNAL", internalQuantity: internalTrade.quantity, internalPrice: internalTrade.price, internalSettlement: settlementDate(internalTrade.ts, settlementLagDays), internalTs: internalTrade.ts });
      continue;
    }

    const first = rows[0];
    if (first === undefined) {
      continue;
    }
    const externalQty = parseQuantity(first.quantity);
    const externalPrice = parsePrice(first.price, args.priceDecimals);
    if (rows.length > 1) {
      breaks.push({ tradeId, type: "DUPLICATE", count: rows.length });
    }
    if (Number(first.tradeTs) > cutoffTs) {
      breaks.push({ tradeId, type: "LATE", externalTs: Number(first.tradeTs) });
    }
    if (externalQty !== undefined && externalQty !== internalTrade.quantity) {
      breaks.push({ tradeId, type: "QUANTITY_MISMATCH", internalQuantity: internalTrade.quantity, externalQuantity: externalQty });
    }
    if (externalPrice !== undefined && externalPrice !== internalTrade.price) {
      breaks.push({ tradeId, type: "PRICE_MISMATCH", internalPrice: internalTrade.price, externalPrice: externalPrice });
    }
    const internalSettlement = settlementDate(internalTrade.ts, settlementLagDays);
    if (first.settlementDate !== internalSettlement) {
      breaks.push({ tradeId, type: "SETTLEMENT_MISMATCH", internalSettlement, externalSettlement: first.settlementDate });
    }
  }

  for (const [tradeId, rows] of [...externalById.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (!internalById.has(tradeId)) {
      breaks.push({ tradeId, type: "MISSING_INTERNAL", count: rows.length });
    }
  }

  return breaks.sort((left, right) => left.tradeId.localeCompare(right.tradeId) || left.type.localeCompare(right.type));
}

function parseQuantity(value: string): bigint | undefined {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return undefined;
  }
  return BigInt(trimmed);
}

function parsePrice(value: string, priceDecimals: number): bigint | undefined {
  const raw = value.trim();
  if (raw.length === 0) {
    return undefined;
  }
  const maybe = raw.replace(/(^\+|^\-)/, "");
  if (!/^\d+(\.\d+)?$/.test(maybe)) {
    return undefined;
  }
  const [whole, fraction = ""] = maybe.split(".");
  if (fraction.length > priceDecimals) {
    return undefined;
  }
  const normalized = fraction.padEnd(priceDecimals, "0");
  const sign = raw.startsWith("-") ? -1n : 1n;
  return sign * (BigInt(whole || "0") * 10n ** BigInt(priceDecimals) + BigInt(normalized));
}

function settlementDate(ts: number, lagDays: number): string {
  const timeMs = BigInt(Math.trunc(ts));
  const days = timeMs / 86_400_000n + BigInt(lagDays);
  const civil = getCivilFromDays(days);
  return `${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`;
}

function getCivilFromDays(days: bigint): { readonly year: number; readonly month: number; readonly day: number } {
  const z = days + 719468n;
  const era = z / 146097n;
  const doe = z - era * 146097n;
  const yoe = (doe - doe / 1460n + doe / 36524n - doe / 146096n) / 365n;
  const year = yoe + era * 400n;
  const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n);
  const mp = (5n * doy + 2n) / 153n;
  const day = doy - ((153n * mp + 2n) / 5n) + 1n;
  const month = mp + (mp < 10n ? 3n : -9n);
  const resolvedYear = year + (month <= 2n ? 1n : 0n);
  return { year: Number(resolvedYear), month: Number(month), day: Number(day) };
}
