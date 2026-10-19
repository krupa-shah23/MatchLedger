-- Week 10 Phase B: Ingress over Kafka
-- Add published_at timestamp to order_requests table
-- Marks the point where SubmitOrder was successfully published to orders.submitted topic

ALTER TABLE order_requests ADD COLUMN published_at timestamptz;

-- Index for queries: "find orders with published_at but no trade yet"
CREATE INDEX idx_order_requests_published_at ON order_requests(published_at)
WHERE published_at IS NOT NULL AND status = 'PENDING_ACK';
