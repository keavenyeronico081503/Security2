INSERT INTO users (
  first_name, last_name, birthday, age, gender, id_number, email, username,
  password, street, barangay, city, province, country, zip_code,
  registration_status, role, account_status, privileges
)
SELECT
  'System', 'Administrator', CURDATE(), 0, 'Male', 'SUPER-0001',
  'emergency-superadmin@localhost', 'Emergencyadmin1',
  '$2y$10$Jt5zS1oeCxySAMuK3B4jLeBr6AVZ8Be/ViYP5zT.D3YEAcBeYPe0W',
  '', '', '', '', '', '', 'complete', 'super_admin', 'approved',
  '{"create_accounts":true,"manage_registrations":true,"assign_privileges":true,"filter_accounts":true,"update_accounts":true,"delete_accounts":true}'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'Emergencyadmin1');
