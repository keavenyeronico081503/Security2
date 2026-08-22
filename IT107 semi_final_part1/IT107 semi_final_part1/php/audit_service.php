<?php
function account_snapshot(int $userId): ?array
{
    global $conn;
    $stmt = $conn->prepare('SELECT id, first_name, last_name, id_number, email, username, role, account_status FROM users WHERE id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc() ?: null;
}

function audit(string $action, ?int $targetUserId = null, array $details = [], ?array $oldValues = null, ?array $newValues = null, bool $success = true, ?string $failureReason = null): void
{
    global $conn;
    $actorId = (int)($_SESSION['user_id'] ?? 0);
    $actor = null;
    if ($actorId > 0) {
        $actorStmt = $conn->prepare('SELECT username, id_number, role FROM users WHERE id = ?');
        $actorStmt->bind_param('i', $actorId);
        $actorStmt->execute();
        $actor = $actorStmt->get_result()->fetch_assoc() ?: null;
    }

    $target = null;
    if ($targetUserId !== null) {
        $targetStmt = $conn->prepare('SELECT username, id_number, role FROM users WHERE id = ?');
        $targetStmt->bind_param('i', $targetUserId);
        $targetStmt->execute();
        $target = $targetStmt->get_result()->fetch_assoc() ?: null;
    }

    $actorUsername = $actor['username'] ?? null;
    $actorEmployeeId = $actor['id_number'] ?? null;
    $actorRole = $actor['role'] ?? null;
    $targetUsername = $target['username'] ?? null;
    $targetEmployeeId = $target['id_number'] ?? null;
    $targetRole = $target['role'] ?? null;
    $encodedDetails = json_encode($details);
    $encodedOldValues = $oldValues === null ? null : json_encode($oldValues);
    $encodedNewValues = $newValues === null ? null : json_encode($newValues);
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 512) ?: null;
    $actorIdValue = $actorId > 0 ? $actorId : null;
    $targetIdValue = $target ? $targetUserId : null;

    $stmt = $conn->prepare('INSERT INTO audit_logs (actor_user_id, actor_username, actor_employee_id, actor_role, action_code, target_user_id, target_username, target_employee_id, target_role, details, old_values, new_values, ip_address, user_agent, success, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('issssissssssssis', $actorIdValue, $actorUsername, $actorEmployeeId, $actorRole, $action, $targetIdValue, $targetUsername, $targetEmployeeId, $targetRole, $encodedDetails, $encodedOldValues, $encodedNewValues, $ipAddress, $userAgent, $success, $failureReason);
    $stmt->execute();
}
