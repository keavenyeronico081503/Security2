<?php
require_once 'account_service.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'list';
$data = request_json();
$user = null;

try {
    if ($action === 'list') {
        require_permission('accounts.view');
        echo json_encode(['status' => 'success', 'users' => list_accounts(trim($_GET['employee_id'] ?? ''))]);
        exit;
    }

    if ($action === 'update') {
        $user = require_permission('accounts.update');
        update_account((int)($data['user_id'] ?? 0), $data);
        echo json_encode(['status' => 'success', 'message' => 'Account information updated.']);
        exit;
    }

    if (in_array($action, ['approve', 'block', 'unblock'], true)) {
        $user = require_permission($action === 'unblock' ? 'accounts.block' : "accounts.$action");
        $targetId = (int)($data['user_id'] ?? 0);
        $oldValues = account_snapshot($targetId);
        $status = $action === 'approve' ? 'approved' : ($action === 'unblock' ? 'approved' : 'blocked');
        $stmt = $conn->prepare('UPDATE users SET account_status = ? WHERE id = ? AND role <> "super_admin"');
        $stmt->bind_param('si', $status, $targetId);
        if (!$stmt->execute() || $stmt->affected_rows < 1) {
            throw new RuntimeException('Account status was not changed.');
        }
        $newValues = account_snapshot($targetId);
        audit("accounts.$action", $targetId, [], $oldValues, $newValues);
        echo json_encode(['status' => 'success', 'message' => "Account $status."]);
        exit;
    }

    if ($action === 'request-delete') {
        $user = require_permission('accounts.delete.request');
        request_account_deletion((int)$user['id'], (int)($data['user_id'] ?? 0), (string)($data['reason'] ?? ''));
        echo json_encode(['status' => 'success', 'message' => 'Deletion request sent to Super Administrator.']);
        exit;
    }

    if ($action === 'create') {
        $user = require_permission('accounts.create');
        $required = ['first_name', 'last_name', 'id_number', 'email', 'username', 'password'];
        foreach ($required as $field) {
            if (trim((string)($data[$field] ?? '')) === '') {
                throw new InvalidArgumentException('All account fields are required.');
            }
        }
        if (strlen((string)$data['password']) < 8) {
            throw new InvalidArgumentException('Password must be at least 8 characters long.');
        }
        $employeeId = next_employee_id();
        $password = password_hash((string)$data['password'], PASSWORD_DEFAULT);
        $role = 'user';
        $status = 'pending';
        $stmt = $conn->prepare('INSERT INTO users (first_name, last_name, birthday, age, gender, id_number, email, username, password, street, barangay, city, province, country, zip_code, registration_status, role, account_status, privileges) VALUES (?, ?, CURDATE(), 0, "Male", ?, ?, ?, ?, "", "", "", "", "", "", "complete", ?, ?, "{}")');
        $stmt->bind_param('ssssssss', $data['first_name'], $data['last_name'], $employeeId, $data['email'], $data['username'], $password, $role, $status);
        if (!$stmt->execute()) {
            throw new RuntimeException('Could not create account: ' . $conn->error);
        }
        $createdUserId = $conn->insert_id;
        $roleStmt = $conn->prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = "user"');
        $roleStmt->bind_param('i', $createdUserId);
        if (!$roleStmt->execute()) {
            $conn->query('DELETE FROM users WHERE id = ' . (int)$createdUserId);
            throw new RuntimeException('Account role could not be assigned.');
        }
        audit('accounts.create', $createdUserId, ['role' => $role, 'username' => $data['username']]);
        echo json_encode(['status' => 'success', 'message' => 'User account created and sent for approval.']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown Administrator action.']);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
