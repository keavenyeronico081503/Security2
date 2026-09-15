ALTER TABLE users
  MODIFY COLUMN role ENUM('super_admin', 'admin', 'data_administrator', 'user') NOT NULL DEFAULT 'user';

INSERT IGNORE INTO roles (code, label)
VALUES ('data_administrator', 'Data Administrator');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'profile.view',
  'profile.update',
  'password.change',
  'accounts.view',
  'accounts.update',
  'accounts.approve',
  'accounts.block',
  'accounts.block.review',
  'accounts.delete.request'
)
WHERE r.code = 'data_administrator';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = u.role
WHERE u.role = 'data_administrator';
