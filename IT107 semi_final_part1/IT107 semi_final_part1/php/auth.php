<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
require_once 'db.php';
require_once 'audit_service.php';

function current_account(bool $approvedOnly = true): ?array
{
    global $conn;
    $userId = (int)($_SESSION['user_id'] ?? 0);
    if ($userId < 1) {
        return null;
    }

    $stmt = $conn->prepare('SELECT u.id, u.username, u.role AS legacy_role, u.account_status, r.code AS role_code FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    if (!$user || ($approvedOnly && $user['account_status'] !== 'approved')) {
        return null;
    }
    return $user;
}

function current_user(): ?array
{
    return current_account(true);
}

function require_auth(): array
{
    $user = current_user();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Authentication required.']);
        exit;
    }
    return $user;
}

function require_identity(): array
{
    $user = current_account(false);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Authentication required.']);
        exit;
    }
    return $user;
}

function can(string $permission, int $userId): bool
{
    global $conn;
    $stmt = $conn->prepare('SELECT EXISTS (SELECT 1 FROM user_permission_overrides o JOIN permissions p ON p.id = o.permission_id WHERE o.user_id = ? AND p.code = ? AND o.effect = "deny") AS denied, EXISTS (SELECT 1 FROM user_permission_overrides o JOIN permissions p ON p.id = o.permission_id WHERE o.user_id = ? AND p.code = ? AND o.effect = "allow") AS allowed, EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = ? AND p.code = ?) AS role_allowed');
    $stmt->bind_param('isisis', $userId, $permission, $userId, $permission, $userId, $permission);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    return !$result['denied'] && ($result['allowed'] || $result['role_allowed']);
}

function require_permission(string $permission): array
{
    $user = require_auth();
    if (!can($permission, (int)$user['id'])) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Permission denied.']);
        exit;
    }
    return $user;
}

function request_json(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : $_POST;
}

