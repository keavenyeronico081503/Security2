-- Announcements: scheduled publishing, optional expiry, priority and pinning.
-- Events: optional start/end time (both NULL = all day).
-- Users: when they last looked at announcements, for the "new" badge.

ALTER TABLE posts
  ADD COLUMN publish_at DATETIME NULL AFTER body,
  ADD COLUMN expires_at DATETIME NULL AFTER publish_at,
  ADD COLUMN priority ENUM('normal', 'important', 'urgent') NOT NULL DEFAULT 'normal' AFTER expires_at,
  ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER priority,
  ADD COLUMN updated_at DATETIME NULL AFTER created_at;

UPDATE posts SET publish_at = created_at WHERE publish_at IS NULL;

ALTER TABLE posts
  MODIFY publish_at DATETIME NOT NULL,
  ADD INDEX idx_posts_visibility (publish_at, expires_at);

ALTER TABLE events
  ADD COLUMN start_time TIME NULL AFTER event_date,
  ADD COLUMN end_time TIME NULL AFTER start_time;

ALTER TABLE users
  ADD COLUMN posts_seen_at DATETIME NULL AFTER notifications_seen_at;
