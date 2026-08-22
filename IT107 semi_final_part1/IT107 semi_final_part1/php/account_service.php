<?php
require_once 'auth.php';

function list_accounts(string $employeeId = ''): array
{
    global $conn;
    $like = "%$employeeId%";
    $stmt = $conn->prepare('SELECT id, first_name, middle_name, last_name, suffix, birthday, age, gender, id_number, email, username, role, account_status, privileges, created_at FROM users WHERE id_number LIKE ? ORDER BY created_at DESC');
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
    $stmt = $conn->prepare('UPDATE users SET first_name = ?, last_name = ?, id_number = ?, email = ? WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('ssssi', $data['first_name'], $data['last_name'], $data['id_number'], $data['email'], $userId);
    if (!$stmt->execute() || $stmt->affected_rows < 1) {
        throw new RuntimeException('Account was not updated.');
    }
    $newValues = account_snapshot($userId);
    audit('accounts.update', $userId, [], $oldValues, $newValues);
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
