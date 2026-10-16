export const MIN_MONEY = -(10n ** 18n);
export const MAX_MONEY = 10n ** 18n;
export function encodeMoney(value) { if (value < MIN_MONEY || value > MAX_MONEY)
    throw new RangeError(`money is outside supported bounds: ${value}`); return value.toString(); }
export function decodeMoney(value) { if (!/^-?(0|[1-9][0-9]*)$/.test(value))
    throw new TypeError(`money must be a canonical decimal string: ${value}`); const parsed = BigInt(value); if (parsed < MIN_MONEY || parsed > MAX_MONEY)
    throw new RangeError(`money is outside supported bounds: ${value}`); return parsed; }
