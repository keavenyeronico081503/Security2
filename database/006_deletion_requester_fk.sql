ALTER TABLE admin_delete_requests
  DROP FOREIGN KEY fk_delete_requester,
  MODIFY COLUMN requested_by INT NULL,
  ADD CONSTRAINT fk_delete_requester_set_null FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
