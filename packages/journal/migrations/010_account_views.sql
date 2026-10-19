CREATE TABLE balances_view (
 account_id text PRIMARY KEY,
 cash bigint NOT NULL DEFAULT 0,
 held_cash bigint NOT NULL DEFAULT 0
);

CREATE TABLE positions_view (
 account_id text NOT NULL,
 symbol text NOT NULL,
 quantity bigint NOT NULL DEFAULT 0,
 held_shares bigint NOT NULL DEFAULT 0,
 cost_basis bigint NOT NULL DEFAULT 0,
 realized_pnl bigint NOT NULL DEFAULT 0,
 PRIMARY KEY (account_id, symbol)
);

CREATE TABLE reservations_view (
 order_id text PRIMARY KEY,
 account_id text NOT NULL,
 symbol text NOT NULL,
 side text NOT NULL,
 asset text NOT NULL,
 amount_total bigint NOT NULL,
 amount_remaining bigint NOT NULL,
 status text NOT NULL CHECK (status IN ('PLACED','PARTIALLY_CONVERTED','CONVERTED','RELEASED')),
 released_reason text,
 converted_amount bigint NOT NULL DEFAULT 0,
 improvement_released bigint NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reservations_view_account ON reservations_view (account_id, status);

CREATE TABLE rejections_view (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source text NOT NULL CHECK (source IN ('RISK','MATCHER')),
 order_id text NOT NULL,
 account_id text NOT NULL,
 symbol text,
 reason text NOT NULL,
 required bigint,
 snapshot_json jsonb,
 ts bigint NOT NULL,
 UNIQUE (source, order_id)
);

CREATE TABLE breaker_view (
 symbol text PRIMARY KEY,
 state text NOT NULL CHECK (state IN ('CLOSED','OPEN','HALF_OPEN')),
 trip_reason text,
 incident_start_ts bigint,
 state_since_ts bigint,
 detail_json jsonb
);
