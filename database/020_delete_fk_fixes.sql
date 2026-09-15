-- Deleting a user account failed with a foreign key violation whenever the
-- account had security questions on file (i.e. any normally-registered
-- account, since submit_question.php always creates one) or had ever been
-- the subject/requester/reviewer of a block request — DELETE FROM users hit
-- a RESTRICT constraint instead of completing. Security questions belong
-- entirely to the user and should be removed with them; block-request
-- history should be kept (matching how admin_delete_requests already
-- behaves for its own columns) with the now-gone user reference cleared
-- instead.

ALTER TABLE security_questions
  DROP FOREIGN KEY security_questions_ibfk_1,
  ADD CONSTRAINT fk_security_questions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE admin_block_requests
  DROP FOREIGN KEY fk_block_requester,
  DROP FOREIGN KEY fk_block_target,
  DROP FOREIGN KEY fk_block_reviewer,
  MODIFY COLUMN requested_by INT NULL,
  MODIFY COLUMN target_user_id INT NULL,
  ADD CONSTRAINT fk_block_requester_set_null FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_block_target_set_null FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_block_reviewer_set_null FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE admin_delete_requests
  DROP FOREIGN KEY fk_delete_reviewer,
  ADD CONSTRAINT fk_delete_reviewer_set_null FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
