<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

require_permission('audit.view');
$actorEmployeeId = trim($_GET['actor_employee_id'] ?? '');
$search = trim($_GET['search'] ?? '');
$actionCode = trim($_GET['action'] ?? '');
$dateFrom = trim($_GET['date_from'] ?? '');
$dateTo = trim($_GET['date_to'] ?? '');
$limit = 10;
$page = max((int)($_GET['page'] ?? 1), 1);
$offset = ($page - 1) * $limit;

$where = ' WHERE actor_username <> "Emergencyadmin1" AND (target_username IS NULL OR target_username <> "Emergencyadmin1")'
    . ' AND (? = "" OR actor_employee_id = ?)'
    . ' AND (? = "" OR action_code = ?)'
    . ' AND (? = "" OR actor_username LIKE CONCAT("%", ?, "%")'
    . ' OR actor_employee_id LIKE CONCAT("%", ?, "%")'
    . ' OR target_username LIKE CONCAT("%", ?, "%")'
    . ' OR target_employee_id LIKE CONCAT("%", ?, "%"))'
    . ' AND (? = "" OR created_at >= ?)'
    . ' AND (? = "" OR created_at < DATE_ADD(?, INTERVAL 1 DAY))';
$filterTypes = 'sssssssssssss';
$filterValues = [$actorEmployeeId, $actorEmployeeId, $actionCode, $actionCode, $search, $search, $search, $search, $search, $dateFrom, $dateFrom, $dateTo, $dateTo];

$countStmt = $conn->prepare('SELECT COUNT(*) AS total FROM audit_logs' . $where);
$countStmt->bind_param($filterTypes, ...$filterValues);
$countStmt->execute();
$total = (int)$countStmt->get_result()->fetch_assoc()['total'];

$stmt = $conn->prepare('SELECT id, actor_username, actor_employee_id, actor_role, action_code, target_username, target_employee_id, target_role, details, old_values, new_values, ip_address, success, failure_reason, created_at FROM audit_logs' . $where . ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?');
$queryValues = array_merge($filterValues, [$limit, $offset]);
$stmt->bind_param($filterTypes . 'ii', ...$queryValues);
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
