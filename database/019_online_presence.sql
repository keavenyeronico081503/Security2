-- Tracks whether an account currently has an active logged-in session, so the
-- "All accounts" table can show a Presence column (Online/Offline) alongside
-- the existing approval Status column. Set to 1 on successful login and reset
-- to 0 on logout (see login.php / logout.php). The hardcoded emergency
-- account has no row here and is therefore never reflected by this column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online TINYINT(1) NOT NULL DEFAULT 0;
