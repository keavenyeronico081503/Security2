CREATE TABLE IF NOT EXISTS admin_block_requests (
  id INT NOT NULL AUTO_INCREMENT,
  requested_by INT NOT NULL,
  target_user_id INT NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  decision_reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_block_request_status (status),
  CONSTRAINT fk_block_requester FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_block_target FOREIGN KEY (target_user_id) REFERENCES users(id),
  CONSTRAINT fk_block_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO permissions (code, label) VALUES
  ('accounts.block.request', 'Request account blocking'),
  ('accounts.block.review', 'Review account block requests');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'accounts.block.request'
WHERE r.code = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'accounts.block.review'
WHERE r.code = 'data_administrator';
