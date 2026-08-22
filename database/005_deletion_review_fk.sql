ALTER TABLE admin_delete_requests
  DROP FOREIGN KEY fk_delete_target,
  MODIFY COLUMN target_user_id INT NULL,
  ADD CONSTRAINT fk_delete_target_set_null FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;
