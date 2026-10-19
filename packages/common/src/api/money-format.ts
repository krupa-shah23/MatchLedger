/**
 * Format bigint minor units to decimal string.
 * @param minor Amount in minor units (e.g., cents)
 * @param decimals Number of decimal places (e.g., 2 for USD)
 * @returns Decimal string (e.g., "123.45")
 */
export function formatMinor(minor: bigint, decimals: number): string {
  if (decimals < 0) throw new Error("decimals must be >= 0");
  if (minor === 0n) return "0" + (decimals > 0 ? "." + "0".repeat(decimals) : "");

  const sign = minor < 0n ? "-" : "";
  const abs = minor < 0n ? -minor : minor;
  const str = abs.toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, -decimals || undefined) || "0";
  const fracPart = decimals > 0 ? str.slice(-decimals) : "";

  return sign + intPart + (fracPart ? "." + fracPart : "");
}

/**
 * Parse decimal string to bigint minor units.
 * @param decimal Decimal string (e.g., "123.45")
 * @param decimals Number of decimal places (e.g., 2 for USD)
 * @returns Amount in minor units as bigint
 * @throws If the string has more decimal places than allowed or is malformed
 */
export function parseDecimalToMinor(decimal: string, decimals: number): bigint {
  if (decimals < 0) throw new Error("decimals must be >= 0");

  const trimmed = decimal.trim();
  const parts = trimmed.split(".");
  const intPart = parts[0];
  const fracPart = parts[1] ?? "";

  if (!intPart || !/^-?\d+$/.test(intPart)) throw new Error(`Invalid integer part: ${intPart}`);
  if (!/^\d*$/.test(fracPart)) throw new Error(`Invalid fractional part: ${fracPart}`);
  if (fracPart.length > decimals) {
    throw new Error(`Too many decimal places: expected at most ${decimals}, got ${fracPart.length}`);
  }

  const sign = intPart.startsWith("-") ? -1n : 1n;
  const absInt = BigInt(intPart.replace("-", ""));
  const fracPadded = fracPart.padEnd(decimals, "0");
  const absFrac = BigInt(fracPadded);

  return sign * (absInt * BigInt(10 ** decimals) + absFrac);
}
