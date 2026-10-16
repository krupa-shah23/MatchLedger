/**
 * Shared risk domain protocol for the Week 6 reservation stage.
 *
 * Money is encoded as bigint minor units and every command and event is replayable
 * from the journal without depending on wall-clock time or the read side.
 */
export const MAX_AMOUNT = 2n ** 63n - 1n;
