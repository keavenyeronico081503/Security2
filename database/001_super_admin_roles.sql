ALTER TABLE users
  ADD COLUMN role ENUM('super_admin', 'admin', 'user') NOT NULL DEFAULT 'user' AFTER password,
  ADD COLUMN account_status ENUM('pending', 'approved', 'blocked') NOT NULL DEFAULT 'pending' AFTER registration_status,
  ADD COLUMN privileges JSON NULL AFTER account_status;

UPDATE users
SET account_status = CASE
  WHEN registration_status = 'complete' THEN 'approved'
  ELSE 'pending'
END;

CREATE TABLE IF NOT EXISTS admin_delete_requests (
  id INT NOT NULL AUTO_INCREMENT,
  requested_by INT NOT NULL,
  target_user_id INT NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY requested_by (requested_by),
  KEY target_user_id (target_user_id),
  CONSTRAINT fk_delete_requester FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_delete_target FOREIGN KEY (target_user_id) REFERENCES users(id),
  CONSTRAINT fk_delete_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
