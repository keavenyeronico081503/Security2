-- Deletion requests keep who they were about and who sent them, so the history
-- still reads correctly after the target (or the requesting admin) is deleted.
-- requested_by / target_user_id become NULL on delete (migrations 005, 006).

ALTER TABLE admin_delete_requests
  ADD COLUMN target_name VARCHAR(120) NULL AFTER target_user_id,
  ADD COLUMN target_id_number VARCHAR(50) NULL AFTER target_name,
  ADD COLUMN requester_username VARCHAR(50) NULL AFTER requested_by;

-- Accounts that still exist.
UPDATE admin_delete_requests r
  JOIN users t ON t.id = r.target_user_id
  SET r.target_name = TRIM(CONCAT(COALESCE(t.first_name, ''), ' ', COALESCE(t.last_name, ''))),
      r.target_id_number = t.id_number;

UPDATE admin_delete_requests r
  JOIN users q ON q.id = r.requested_by
  SET r.requester_username = q.username;

-- Already-deleted targets: recover what the audit log recorded when the request was approved.
UPDATE admin_delete_requests r
  JOIN audit_logs a ON a.action_code = 'accounts.delete.approve'
                   AND JSON_VALUE(a.details, '$.request_id') = r.id
  SET r.target_name = COALESCE(r.target_name, a.target_username),
      r.target_id_number = COALESCE(r.target_id_number, a.target_employee_id)
  WHERE r.target_user_id IS NULL;
