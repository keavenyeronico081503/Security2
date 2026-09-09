<?php
require_once 'auth.php';
require_once 'email_policy.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'session';

if ($action === 'profile') {
    $user = require_permission('profile.view');
    $stmt = $conn->prepare('SELECT first_name, middle_name, last_name, suffix, id_number, email, contact_number, username, account_status, role FROM users WHERE id = ?');
    $stmt->bind_param('i', $user['id']);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    echo json_encode(['status' => 'success', 'profile' => $profile]);
    exit;
}

if ($action === 'update-profile') {
    $user = require_permission('profile.update');
    $firstName = trim((string)($_POST['first_name'] ?? ''));
    $middleName = trim((string)($_POST['middle_name'] ?? ''));
    $lastName = trim((string)($_POST['last_name'] ?? ''));
    $suffix = trim((string)($_POST['suffix'] ?? ''));
    $email = trim((string)($_POST['email'] ?? ''));
    $contact = trim((string)($_POST['contact_number'] ?? ''));
    if ($firstName === '' || $lastName === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'First name and last name are required.']);
        exit;
    }
    if (!is_institutional_email($email)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => institutional_email_error_message()]);
        exit;
    }
    if ($contact !== '' && !preg_match('/^[0-9+() .-]{7,30}$/', $contact)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Please provide a valid contact number.']);
        exit;
    }
    $emailCheck = $conn->prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1');
    $emailCheck->bind_param('si', $email, $user['id']);
    $emailCheck->execute();
    if ($emailCheck->get_result()->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['status' => 'error', 'message' => 'That email address is already in use.']);
        exit;
    }
    $oldValues = account_snapshot((int)$user['id']);
    $stmt = $conn->prepare('UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?, email = ?, contact_number = ? WHERE id = ?');
    $stmt->bind_param('ssssssi', $firstName, $middleName, $lastName, $suffix, $email, $contact, $user['id']);
    if (!$stmt->execute()) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Profile could not be updated.']);
        exit;
    }
    audit('profile.update', (int)$user['id'], [], $oldValues, account_snapshot((int)$user['id']));
    echo json_encode(['status' => 'success', 'message' => 'Profile updated successfully.']);
    exit;
}

if ($action === 'status') {
    $user = require_identity();
    if ($user['role_code'] !== 'user' || $user['account_status'] !== 'pending' || !can('account.status.view', (int)$user['id'])) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Pending account status is unavailable.']);
        exit;
    }
    $nameStmt = $conn->prepare('SELECT first_name, last_name FROM users WHERE id = ?');
    $nameStmt->bind_param('i', $user['id']);
    $nameStmt->execute();
    $name = $nameStmt->get_result()->fetch_assoc() ?: [];
    echo json_encode([
        'status' => 'success',
        'account' => [
            'username' => $user['username'],
            'account_status' => $user['account_status'],
            'role' => $user['role_code'],
            'display_name' => trim(($name['first_name'] ?? '') . ' ' . ($name['last_name'] ?? ''))
        ]
    ]);
    exit;
}

$user = require_permission('dashboard.view');
$permissionStmt = $conn->prepare('SELECT DISTINCT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id JOIN user_roles ur ON ur.role_id = rp.role_id WHERE ur.user_id = ? AND NOT EXISTS (SELECT 1 FROM user_permission_overrides deny_override WHERE deny_override.user_id = ? AND deny_override.permission_id = p.id AND deny_override.effect = "deny") UNION SELECT p.code FROM permissions p JOIN user_permission_overrides allow_override ON allow_override.permission_id = p.id WHERE allow_override.user_id = ? AND allow_override.effect = "allow"');
$permissionStmt->bind_param('iii', $user['id'], $user['id'], $user['id']);
$permissionStmt->execute();
$permissions = [];
$result = $permissionStmt->get_result();
while ($row = $result->fetch_assoc()) $permissions[] = $row['code'];

echo json_encode([
    'status' => 'success',
    'user' => [
        'username' => $user['username'],
        'role' => $user['role_code'],
        'permissions' => $permissions
    ]
]);
