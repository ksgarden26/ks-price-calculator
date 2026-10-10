-- KS Garden Services customer reviews. Apply once to the production D1 database.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  email TEXT,
  email_opt_in INTEGER NOT NULL DEFAULT 0,
  owner_reply TEXT,
  replied_at TEXT,
  notification_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT PRIMARY KEY,
  last_review_at INTEGER NOT NULL DEFAULT 0,
  login_failed INTEGER NOT NULL DEFAULT 0,
  login_window_at INTEGER NOT NULL DEFAULT 0,
  lock_until INTEGER NOT NULL DEFAULT 0
);