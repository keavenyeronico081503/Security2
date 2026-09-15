ALTER TABLE audit_logs
  ADD COLUMN actor_username VARCHAR(50) NULL AFTER actor_user_id,
  ADD COLUMN actor_employee_id VARCHAR(20) NULL AFTER actor_username,
  ADD COLUMN actor_role VARCHAR(50) NULL AFTER actor_employee_id,
  ADD COLUMN target_username VARCHAR(50) NULL AFTER target_user_id,
  ADD COLUMN target_employee_id VARCHAR(20) NULL AFTER target_username,
  ADD COLUMN target_role VARCHAR(50) NULL AFTER target_employee_id,
  ADD COLUMN old_values JSON NULL AFTER details,
  ADD COLUMN new_values JSON NULL AFTER old_values,
  ADD COLUMN ip_address VARCHAR(45) NULL AFTER new_values,
  ADD COLUMN user_agent VARCHAR(512) NULL AFTER ip_address,
  ADD COLUMN success TINYINT(1) NOT NULL DEFAULT 1 AFTER user_agent,
  ADD COLUMN failure_reason VARCHAR(255) NULL AFTER success;
