const BASE_BPS = 10000n;
export const ceilDiv = (value, divisor) => {
    if (divisor === 0n) {
        throw new Error("division by zero");
    }
    const quotient = value / divisor;
    const remainder = value % divisor;
    return remainder === 0n ? quotient : quotient + 1n;
};
export const floorDiv = (value, divisor) => {
    if (divisor === 0n) {
        throw new Error("division by zero");
    }
    return value / divisor;
};
export const volatilityBps = (window) => {
    if (window.length === 0) {
        return 0n;
    }
    const min = window.reduce((best, value) => (value < best ? value : best), window[0]);
    const max = window.reduce((best, value) => (value > best ? value : best), window[0]);
    if (min <= 0n) {
        return 0n;
    }
    return ((max - min) * BASE_BPS) / min;
};
export const bandBounds = (anchor, bps) => {
    const lower = ceilDiv(anchor * (BASE_BPS - bps), BASE_BPS);
    const upper = floorDiv(anchor * (BASE_BPS + bps), BASE_BPS);
    return { lower, upper };
};
