-- Each account's own previous password hashes, so a password change can refuse
-- recent reuse without ever comparing against other people's passwords.
CREATE TABLE IF NOT EXISTS password_history (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY password_history_user (user_id, changed_at),
  CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Fixed-window request counters for public lookup endpoints (per endpoint + IP).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket VARCHAR(100) NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  window_start DATETIME NOT NULL,
  PRIMARY KEY (bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
