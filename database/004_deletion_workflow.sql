ALTER TABLE admin_delete_requests
  ADD COLUMN decision_reason TEXT NULL AFTER status,
  ADD COLUMN executed_at DATETIME NULL AFTER reviewed_at;
