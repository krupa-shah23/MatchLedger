/** API monetary decimal strings are displayed as Indian rupees; values are not FX converted. */
export function displayMoney(value: string | null | undefined): string {
  if (value == null) return "—";
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return "Invalid";
  return `${match[1]}₹${match[2]}.${(match[3] ?? "").padEnd(2, "0")}`;
}
