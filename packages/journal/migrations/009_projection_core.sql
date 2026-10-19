CREATE TABLE projection_checkpoints (
 projection text NOT NULL,
 stream_id text NOT NULL,
 last_seq bigint NOT NULL CHECK (last_seq >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (projection, stream_id)
);

CREATE TABLE orders_view (
 order_id text PRIMARY KEY,
 account_id text NOT NULL,
 client_order_id text,
 symbol text NOT NULL,
 side text NOT NULL,
 order_type text NOT NULL,
 time_in_force text NOT NULL,
 quantity bigint NOT NULL,
 price bigint,
 effective_price bigint,
 received_ts bigint,
 accepted boolean NOT NULL DEFAULT false,
 rested boolean NOT NULL DEFAULT false,
 filled_qty bigint NOT NULL DEFAULT 0,
 filled_notional bigint NOT NULL DEFAULT 0,
 terminal text CHECK (terminal IN ('CANCELLED','REJECTED')),
 terminal_reason text,
 cancel_requested boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_view_account ON orders_view (account_id, created_at DESC, order_id);
CREATE INDEX orders_view_symbol_status ON orders_view (symbol, terminal);

CREATE TABLE order_fills (
 order_id text NOT NULL,
 trade_id text NOT NULL,
 price bigint NOT NULL,
 quantity bigint NOT NULL,
 role text NOT NULL CHECK (role IN ('TAKER','MAKER')),
 ts bigint NOT NULL,
 PRIMARY KEY (order_id, trade_id)
);

CREATE TABLE resting_orders (
 symbol text NOT NULL,
 order_id text NOT NULL,
 side text NOT NULL,
 price bigint NOT NULL,
 remaining bigint NOT NULL CHECK (remaining > 0),
 PRIMARY KEY (symbol, order_id)
);

CREATE INDEX resting_orders_level ON resting_orders (symbol, side, price);

CREATE TABLE trades_view (
 symbol text NOT NULL,
 engine_seq bigint NOT NULL,
 idx integer NOT NULL,
 trade_id text NOT NULL,
 price bigint NOT NULL,
 quantity bigint NOT NULL,
 taker_side text NOT NULL,
 ts bigint NOT NULL,
 PRIMARY KEY (symbol, engine_seq, idx)
);
