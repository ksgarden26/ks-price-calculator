-- Run against the same ks-reviews D1 database before enabling newsletters.
-- Contains only hashed request throttling and weekly campaign audit records.
-- Subscriber emails are stored by Brevo, never in D1 or the CRM.
CREATE TABLE IF NOT EXISTS newsletter_request_limits (
  ip_hash TEXT PRIMARY KEY,
  last_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newsletter_request_limits_last ON newsletter_request_limits(last_at);
CREATE TABLE IF NOT EXISTS newsletter_campaign_runs (
  issue_date TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('preparing','created','submitted','failed')),
  campaign_id INTEGER,
  created_at TEXT NOT NULL
);
