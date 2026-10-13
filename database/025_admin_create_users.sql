-- Administrators may create regular user accounts. Those accounts wait in
-- pending_registrations for approval, and after approval the person finishes
-- setup (email code, password, address, security questions) at first login.
-- Creating administrator accounts stays Super-Administrator-only
-- (super-admin.php requires require_super_admin()).
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'accounts.create' WHERE r.code = 'admin';
