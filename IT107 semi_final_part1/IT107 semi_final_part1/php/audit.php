<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

require_permission('audit.view');
$actorEmployeeId = trim($_GET['actor_employee_id'] ?? '');
$actionCode = trim($_GET['action'] ?? '');
$limit = 10;
$page = max((int)($_GET['page'] ?? 1), 1);
$offset = ($page - 1) * $limit;

$countStmt = $conn->prepare('SELECT COUNT(*) AS total FROM audit_logs WHERE (? = "" OR actor_employee_id = ?) AND (? = "" OR action_code = ?)');
$countStmt->bind_param('ssss', $actorEmployeeId, $actorEmployeeId, $actionCode, $actionCode);
$countStmt->execute();
$total = (int)$countStmt->get_result()->fetch_assoc()['total'];

$sql = 'SELECT id, actor_username, actor_employee_id, actor_role, action_code, target_username, target_employee_id, target_role, details, old_values, new_values, ip_address, success, failure_reason, created_at FROM audit_logs WHERE (? = "" OR actor_employee_id = ?) AND (? = "" OR action_code = ?) ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
$stmt = $conn->prepare($sql);
$stmt->bind_param('ssssii', $actorEmployeeId, $actorEmployeeId, $actionCode, $actionCode, $limit, $offset);
$stmt->execute();
$result = $stmt->get_result();
$logs = [];
while ($log = $result->fetch_assoc()) {
    $log['details'] = json_decode($log['details'] ?: '{}', true) ?: [];
    $log['old_values'] = json_decode($log['old_values'] ?: 'null', true);
    $log['new_values'] = json_decode($log['new_values'] ?: 'null', true);
    $logs[] = $log;
}
echo json_encode(['status' => 'success', 'logs' => $logs, 'pagination' => ['page' => $page, 'per_page' => $limit, 'total' => $total, 'total_pages' => max((int)ceil($total / $limit), 1)]]);
