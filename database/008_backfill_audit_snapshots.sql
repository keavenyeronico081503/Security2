UPDATE audit_logs a
LEFT JOIN users actor ON actor.id = a.actor_user_id
LEFT JOIN users target ON target.id = a.target_user_id
SET
  a.actor_username = COALESCE(a.actor_username, actor.username),
  a.actor_employee_id = COALESCE(a.actor_employee_id, actor.id_number),
  a.actor_role = COALESCE(a.actor_role, actor.role),
  a.target_username = COALESCE(a.target_username, target.username),
  a.target_employee_id = COALESCE(a.target_employee_id, target.id_number),
  a.target_role = COALESCE(a.target_role, target.role)
WHERE a.actor_username IS NULL OR a.target_username IS NULL;
