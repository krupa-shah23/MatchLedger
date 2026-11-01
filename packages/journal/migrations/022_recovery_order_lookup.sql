-- Efficiently find matching commands when redelivering accepted orders.
CREATE INDEX IF NOT EXISTS journal_command_order_lookup
  ON journal (stream_id, (payload_json->>'orderId'))
  WHERE record_type = 'COMMAND';
