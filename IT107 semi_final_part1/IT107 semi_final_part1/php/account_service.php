<?php
require_once 'auth.php';
require_once 'email_policy.php';
require_once 'mailer.php';

function next_employee_id(): string
{
    global $conn;
    $year = date('Y');
    $stmt = $conn->prepare('SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(id_number, "-", -1) AS UNSIGNED)), 0) AS last_number FROM users WHERE id_number LIKE CONCAT(?, "-%")');
    $stmt->bind_param('s', $year);
    $stmt->execute();
    $lastNumber = (int)$stmt->get_result()->fetch_assoc()['last_number'];
    return $year . '-' . str_pad((string)($lastNumber + 1), 4, '0', STR_PAD_LEFT);
}

function deactivate_inactive_accounts(): void
{
    global $conn;
    $candidates = $conn->query('SELECT id FROM users WHERE username <> "Keavenyadmin1" AND account_status = "approved" AND COALESCE(last_login_at, created_at) < NOW() - INTERVAL 7 DAY');
    while ($row = $candidates->fetch_assoc()) {
        $stmt = $conn->prepare('UPDATE users SET account_status = "blocked" WHERE id = ?');
        $stmt->bind_param('i', $row['id']);
        $stmt->execute();
        audit('accounts.block', (int)$row['id'], ['reason' => 'Automatically deactivated after 7 days of inactivity']);
    }
}

function list_accounts(string $employeeId = ''): array
{
    global $conn;
    deactivate_inactive_accounts();
    $like = "%$employeeId%";
    $stmt = $conn->prepare('SELECT id, first_name, middle_name, last_name, suffix, birthday, age, gender, id_number, email, username, role, account_status, privileges, created_at FROM users WHERE id_number LIKE ? AND username <> "Keavenyadmin1" ORDER BY created_at DESC');
    $stmt->bind_param('s', $like);
    $stmt->execute();
    $users = [];
    $result = $stmt->get_result();
    while ($user = $result->fetch_assoc()) {
        $user['privileges'] = json_decode($user['privileges'] ?: '{}', true) ?: [];
        $users[] = $user;
    }
    return $users;
}

function update_account(int $userId, array $data): void
{
    global $conn;
    $oldValues = account_snapshot($userId);
    if (!$oldValues) {
        throw new RuntimeException('Account was not found.');
    }
    if ($oldValues['role'] === 'super_admin') {
        throw new RuntimeException('Super Administrator accounts cannot be edited here.');
    }
    $username = trim((string)($data['username'] ?? ''));
    if ($username === '') {
        throw new InvalidArgumentException('Username is required.');
    }
    $email = trim((string)($data['email'] ?? ''));
    if (!is_institutional_email($email)) {
        throw new InvalidArgumentException(institutional_email_error_message());
    }
    $usernameCheck = $conn->prepare('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1');
    $usernameCheck->bind_param('si', $username, $userId);
    $usernameCheck->execute();
    if ($usernameCheck->get_result()->fetch_assoc()) {
        throw new InvalidArgumentException('That username is already taken.');
    }
    $stmt = $conn->prepare('UPDATE users SET first_name = ?, last_name = ?, id_number = ?, email = ?, username = ? WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('sssssi', $data['first_name'], $data['last_name'], $data['id_number'], $email, $username, $userId);
    if (!$stmt->execute()) {
        throw new RuntimeException('Account was not updated: ' . $conn->error);
    }
    $newValues = account_snapshot($userId);
    audit('accounts.update', $userId, [], $oldValues, $newValues);
}

function reset_account_password(int $userId): void
{
    global $conn;
    $oldValues = account_snapshot($userId);
    if (!$oldValues) {
        throw new RuntimeException('Account was not found.');
    }
    if ($oldValues['role'] === 'super_admin') {
        throw new RuntimeException('Super Administrator accounts cannot be reset here.');
    }
    if (!is_institutional_email((string)$oldValues['email'])) {
        throw new RuntimeException('This account has no valid institutional email on file. Update its email before resetting the password.');
    }

    $defaultPassword = 'Abcde12345';
    $subject = 'Your Security2 account password was reset';
    $body = "Hello {$oldValues['first_name']},\n\n"
        . "An administrator reset your Security2 account password.\n\n"
        . "Your temporary password is: $defaultPassword\n\n"
        . "Log in with this password — you will be asked to choose a new password immediately before you can access your account. If you did not expect this, contact your administrator immediately.";

    // Send before persisting: if the email fails, the account keeps its old working
    // password instead of being locked out with a password nobody received.
    if (!send_email($oldValues['email'], $oldValues['first_name'] . ' ' . $oldValues['last_name'], $subject, $body)) {
        throw new RuntimeException('Could not send the reset email. The password was not changed.');
    }

    $hashed = password_hash($defaultPassword, PASSWORD_DEFAULT);
    $stmt = $conn->prepare('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('si', $hashed, $userId);
    if (!$stmt->execute()) {
        throw new RuntimeException('Password was not reset: ' . $conn->error);
    }
    audit('accounts.password_reset', $userId);
}

function change_account_role(int $userId, string $newRole): void
{
    global $conn;
    $allowedRoles = ['admin', 'data_administrator'];
    if (!in_array($newRole, $allowedRoles, true)) {
        throw new InvalidArgumentException('Role must be Administrator or Data Administrator.');
    }
    $oldValues = account_snapshot($userId);
    if (!$oldValues) {
        throw new RuntimeException('Account was not found.');
    }
    if ($oldValues['role'] === 'super_admin') {
        throw new RuntimeException('Super Administrator accounts cannot have their role changed here.');
    }
    if ($oldValues['role'] === $newRole) {
        return;
    }
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare('UPDATE users SET role = ? WHERE id = ? AND role <> "super_admin"');
        $stmt->bind_param('si', $newRole, $userId);
        if (!$stmt->execute()) {
            throw new RuntimeException('Role was not changed: ' . $conn->error);
        }
        $clearRoles = $conn->prepare('DELETE FROM user_roles WHERE user_id = ?');
        $clearRoles->bind_param('i', $userId);
        $clearRoles->execute();
        $assignRole = $conn->prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?');
        $assignRole->bind_param('is', $userId, $newRole);
        if (!$assignRole->execute()) {
            throw new RuntimeException('Role permissions were not assigned.');
        }
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
    $newValues = account_snapshot($userId);
    audit('accounts.role_change', $userId, [], $oldValues, $newValues);
}

function request_account_deletion(int $requesterId, int $targetUserId, string $reason): void
{
    global $conn;
    if ($requesterId === $targetUserId || trim($reason) === '') {
        throw new InvalidArgumentException('A valid deletion reason and target account are required.');
    }
    $stmt = $conn->prepare('INSERT INTO admin_delete_requests (requested_by, target_user_id, reason) SELECT ?, id, ? FROM users WHERE id = ? AND role <> "super_admin" AND account_status <> "blocked"');
    $stmt->bind_param('isi', $requesterId, $reason, $targetUserId);
    if (!$stmt->execute() || $stmt->affected_rows < 1) {
        throw new RuntimeException('Deletion request could not be created for this account.');
    }
    audit('accounts.delete.request', $targetUserId, ['reason' => $reason]);
}
