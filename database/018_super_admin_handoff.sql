-- A Super Administrator who creates a new Super Administrator account, or who
-- reactivates a deactivated one, is flagged here to step down cleanly: they
-- stay active alongside the (re)activated account until they themselves log
-- out, at which point they are automatically deactivated. This lets a handoff
-- happen without an abrupt mid-session kick, while still converging back to
-- only one non-emergency Super Administrator active once everyone involved
-- has logged out.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivate_on_logout TINYINT(1) NOT NULL DEFAULT 0;
