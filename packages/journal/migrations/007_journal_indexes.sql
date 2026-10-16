CREATE INDEX IF NOT EXISTS journal_cmd_order ON journal ((payload_json->>'orderId')) WHERE record_type = 'COMMAND';
CREATE INDEX IF NOT EXISTS journal_evt_order ON journal ((payload_json->>'orderId')) WHERE record_type = 'EVENT';
CREATE INDEX IF NOT EXISTS journal_evt_taker ON journal ((payload_json->>'takerOrderId')) WHERE record_type = 'EVENT';
CREATE INDEX IF NOT EXISTS journal_evt_maker ON journal ((payload_json->>'makerOrderId')) WHERE record_type = 'EVENT';
CREATE INDEX IF NOT EXISTS journal_evt_type ON journal (stream_id, (payload_json->>'type'), seq) WHERE record_type = 'EVENT';
