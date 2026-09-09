-- The real emergency admin credentials live only in php/emergency_admin.php and are
-- verified in code, never against this row's password column. This seed just gives a
-- fresh database a placeholder row so the account exists before the first emergency
-- login; php/emergency_admin.php overwrites the password column with an unusable
-- random value every time that login path runs.
INSERT INTO users (
  first_name, last_name, birthday, age, gender, id_number, email, username,
  password, street, barangay, city, province, country, zip_code,
  registration_status, role, account_status, privileges
)
SELECT
  'Emergency', 'Administrator', CURDATE(), 0, 'Male', 'SUPER-EMERGENCY-0001',
  'emergency-superadmin@localhost', 'Keavenyadmin1',
  '$2y$10$kbhqxJmDsRxucn1Hz2bzQueOgRIwXld1HcUQfXFCoSUsZ0jJ.KCuG',
  '', '', '', '', '', '', 'complete', 'super_admin', 'approved',
  '{"create_accounts":true,"manage_registrations":true,"assign_privileges":true,"filter_accounts":true,"update_accounts":true,"delete_accounts":true}'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'Keavenyadmin1');
