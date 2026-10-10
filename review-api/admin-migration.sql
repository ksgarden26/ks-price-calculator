-- Apply this to an EXISTING live ks-reviews D1 database, once, to enable the unified admin.
CREATE TABLE IF NOT EXISTS legacy_review_replies (review_id TEXT PRIMARY KEY, owner_reply TEXT NOT NULL, replied_at TEXT NOT NULL);
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
CREATE TABLE IF NOT EXISTS gallery_photos (
  id TEXT PRIMARY KEY,
  job TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Garden work',
  caption TEXT,
  image_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_created ON gallery_photos(created_at DESC);

-- Private, editable customer quotes. No public access to quote information.
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  quote_no TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Sent','Accepted','Declined')),
  area_m2 REAL NOT NULL DEFAULT 0,
  total_gbp REAL NOT NULL DEFAULT 0,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotes_updated ON quotes(updated_at DESC);
