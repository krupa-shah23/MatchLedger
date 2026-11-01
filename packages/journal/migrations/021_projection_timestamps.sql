-- Repair sequence numbers previously projected as wall-clock timestamps.
UPDATE trades_view t SET ts = j.ts
FROM journal j
WHERE j.stream_id = t.symbol AND j.seq = t.engine_seq
  AND j.idx = t.idx AND j.record_type = 'EVENT' AND t.ts IS DISTINCT FROM j.ts;

UPDATE order_fills f SET ts = t.ts
FROM trades_view t WHERE f.trade_id = t.trade_id AND f.ts IS DISTINCT FROM t.ts;

UPDATE orders_view o SET received_ts = j.ts
FROM journal j
WHERE j.record_type = 'COMMAND' AND j.payload_json->>'type' = 'SubmitOrder'
  AND j.payload_json->>'orderId' = o.order_id AND o.received_ts IS DISTINCT FROM j.ts;
