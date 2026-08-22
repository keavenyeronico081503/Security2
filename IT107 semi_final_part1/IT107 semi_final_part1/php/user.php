<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'session';

if ($action === 'status') {
    $user = require_identity();
    if ($user['role_code'] !== 'user' || $user['account_status'] !== 'pending' || !can('account.status.view', (int)$user['id'])) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Pending account status is unavailable.']);
        exit;
    }
    echo json_encode([
        'status' => 'success',
        'account' => [
            'username' => $user['username'],
            'account_status' => $user['account_status'],
            'role' => $user['role_code']
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
