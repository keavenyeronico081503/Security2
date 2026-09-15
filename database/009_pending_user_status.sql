INSERT IGNORE INTO permissions (code, label)
VALUES ('account.status.view', 'View account approval status');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'account.status.view'
WHERE r.code = 'user';
