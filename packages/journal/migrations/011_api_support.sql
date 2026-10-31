ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS symbol text, ADD COLUMN IF NOT EXISTS account_owner_user text;
