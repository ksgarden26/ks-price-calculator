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

-- Unified private admin: public replies to historical reviews without email addresses.
CREATE TABLE IF NOT EXISTS legacy_review_replies (
  review_id TEXT PRIMARY KEY,
  owner_reply TEXT NOT NULL,
  replied_at TEXT NOT NULL
);

-- Editable news and tips. The published set is merged with static seed articles.
CREATE TABLE IF NOT EXISTS news_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Garden advice',
  body TEXT NOT NULL,
  image_url TEXT,
  source_url TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_news_posts_updated ON news_posts(updated_at DESC);

-- Photo bytes are stored in R2; only public metadata is stored in D1.
CREATE TABLE IF NOT EXISTS gallery_photos (
  id TEXT PRIMARY KEY,
  job TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Garden work',
  caption TEXT,
  image_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_created ON gallery_photos(created_at DESC);
