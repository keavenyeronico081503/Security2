DELIMITER //

DROP TRIGGER IF EXISTS audit_logs_no_update//
CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit records are immutable and cannot be updated.';
END//

DROP TRIGGER IF EXISTS audit_logs_no_delete//
CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit records are immutable and cannot be deleted.';
END//

DELIMITER ;
