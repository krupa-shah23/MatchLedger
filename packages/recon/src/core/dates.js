function floorDivBigInt(value, divisor) {
    const quotient = value / divisor;
    const remainder = value % divisor;
    if (remainder === 0n) {
        return quotient;
    }
    if ((value < 0n) !== (divisor < 0n)) {
        return quotient - 1n;
    }
    return quotient;
}
export function civilFromDays(days) {
    const value = typeof days === "bigint" ? days : BigInt(days);
    const z = value + 719468n;
    const era = z / 146097n;
    const doe = z - era * 146097n;
    const yoe = (doe - doe / 1460n + doe / 36524n - doe / 146096n) / 365n;
    const year = yoe + era * 400n;
    const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n);
    const mp = (5n * doy + 2n) / 153n;
    const day = doy - ((153n * mp + 2n) / 5n) + 1n;
    const month = mp + (mp < 10n ? 3n : -9n);
    const resolvedYear = year + (month <= 2n ? 1n : 0n);
    return {
        year: Number(resolvedYear),
        month: Number(month),
        day: Number(day),
    };
}
export function settlementDate(ts, lagDays) {
    const timeMs = typeof ts === "bigint" ? ts : BigInt(Math.trunc(ts));
    const days = floorDivBigInt(timeMs, 86400000n) + BigInt(lagDays);
    const civil = civilFromDays(days);
    return `${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`;
}
