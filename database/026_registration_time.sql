-- When the person actually signed up. users.created_at is the moment the account
-- row was made, which for student sign-ups is the approval time (pending sign-ups
-- live in pending_registrations until then). Statistics use registered_at.
ALTER TABLE users ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP NULL DEFAULT NULL AFTER created_at;

-- Existing accounts: best available value is the account creation time.
UPDATE users SET registered_at = created_at WHERE registered_at IS NULL;
