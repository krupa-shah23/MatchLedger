export const validateBreakerConfig = (config) => {
    if (config.windowTrades < 2) {
        throw new Error("BreakerConfig: windowTrades must be >= 2");
    }
    if (config.tripThresholdBps <= 0n) {
        throw new Error("BreakerConfig: tripThresholdBps must be positive");
    }
    if (config.resetThresholdBps < 0n || config.resetThresholdBps >= config.tripThresholdBps) {
        throw new Error("BreakerConfig: resetThresholdBps must satisfy 0 <= reset < trip");
    }
    if (config.cooldownMs <= 0 || config.halfOpenStableMs <= 0 || config.maxHaltDurationMs <= 0) {
        throw new Error("BreakerConfig: durations must be positive");
    }
    if (config.halfOpenMaxOrdersPerSec <= 0) {
        throw new Error("BreakerConfig: halfOpenMaxOrdersPerSec must be positive");
    }
    if (config.halfOpenBandBps <= 0n) {
        throw new Error("BreakerConfig: halfOpenBandBps must be positive");
    }
};
