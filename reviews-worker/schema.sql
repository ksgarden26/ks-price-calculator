-- KS Garden Services website reviews. All ratings (1-5) are treated equally.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published')),
  owner_reply TEXT,
  replied_at TEXT,
  published_at TEXT,
  email_consent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reviews_status_date ON reviews(status,created_at DESC);

-- Hashed per-day rate limit; no raw IP is saved.
CREATE TABLE IF NOT EXISTS review_rate_limits (
  fingerprint TEXT PRIMARY KEY,
  submission_count INTEGER NOT NULL DEFAULT 1,
  day TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_day ON review_rate_limits(day);
