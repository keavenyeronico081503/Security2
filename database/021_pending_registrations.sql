-- Accounts waiting for approval live here, never in `users`. Approving moves a
-- row into `users`; rejecting deletes it (see account_service.php).
CREATE TABLE IF NOT EXISTS pending_registrations (
  id INT NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) NULL,
  last_name VARCHAR(50) NOT NULL,
  suffix VARCHAR(10) NULL,
  birthday DATE NOT NULL,
  age INT NOT NULL,
  gender ENUM('Male', 'Female') NOT NULL,
  id_number VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  street VARCHAR(100) NOT NULL,
  barangay VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  zip_code VARCHAR(10) NOT NULL,
  question1 VARCHAR(255) NULL,
  answer1 VARCHAR(255) NULL,
  question2 VARCHAR(255) NULL,
  answer2 VARCHAR(255) NULL,
  question3 VARCHAR(255) NULL,
  answer3 VARCHAR(255) NULL,
  created_by INT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY pending_id_number (id_number),
  UNIQUE KEY pending_email (email),
  UNIQUE KEY pending_username (username),
  KEY pending_created_by (created_by),
  CONSTRAINT fk_pending_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Move regular users still waiting for approval out of `users`.
INSERT IGNORE INTO pending_registrations
  (first_name, middle_name, last_name, suffix, birthday, age, gender, id_number, email, username, password,
   street, barangay, city, province, country, zip_code,
   question1, answer1, question2, answer2, question3, answer3, submitted_at)
SELECT u.first_name, u.middle_name, u.last_name, u.suffix, u.birthday, u.age, u.gender, u.id_number, u.email, u.username, u.password,
       u.street, u.barangay, u.city, u.province, u.country, u.zip_code,
       sq.authQuestion1, sq.authAnswer1, sq.authQuestion2, sq.authAnswer2, sq.authQuestion3, sq.authAnswer3, u.created_at
FROM users u
LEFT JOIN security_questions sq ON sq.user_id = u.id
WHERE u.role = 'user' AND u.account_status = 'pending';

DELETE u FROM users u
JOIN pending_registrations p ON p.username = u.username
WHERE u.role = 'user' AND u.account_status = 'pending';

-- Data Administrator is not part of the course scope: fold any such accounts
-- into Administrator and remove the role. Its block-request review duty moves
-- to the Super Administrator.
UPDATE users SET role = 'admin' WHERE role = 'data_administrator';
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT ur.user_id, admin_role.id
FROM user_roles ur
JOIN roles data_role ON data_role.id = ur.role_id AND data_role.code = 'data_administrator'
JOIN roles admin_role ON admin_role.code = 'admin';
DELETE FROM roles WHERE code = 'data_administrator';
ALTER TABLE users MODIFY role ENUM('super_admin', 'admin', 'user') NOT NULL DEFAULT 'user';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'accounts.block.review' WHERE r.code = 'super_admin';
