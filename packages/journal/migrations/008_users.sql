CREATE TABLE users (
 user_id text PRIMARY KEY,
 username text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('TRADER','RISK','OPS','ADMIN')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_accounts (
 user_id text NOT NULL REFERENCES users(user_id),
 account_id text NOT NULL,
 PRIMARY KEY (user_id, account_id),
 UNIQUE (account_id)
);
