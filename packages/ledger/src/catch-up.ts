// Ledger catch-up builds ledger from risk and engine event journals
// Idempotent: second run posts nothing (commands already in ledger)
// Algorithm: stream deposits, adjustments, and trades; build txs with extracted tx-id functions
// Balances equal risk balances afterwards (verified separately in tests)
