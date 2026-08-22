<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$user = require_permission('accounts.view');
$summary = ['total' => 0, 'approved' => 0, 'pending' => 0, 'blocked' => 0, 'my_requests' => 0];
$result = $conn->query('SELECT COUNT(*) AS total, SUM(account_status = "approved") AS approved, SUM(account_status = "pending") AS pending, SUM(account_status = "blocked") AS blocked FROM users WHERE role <> "super_admin"');
$row = $result->fetch_assoc();
foreach (['total', 'approved', 'pending', 'blocked'] as $key) $summary[$key] = (int)($row[$key] ?? 0);

$requestSql = can('accounts.delete.approve', (int)$user['id'])
    ? 'SELECT COUNT(*) AS total FROM admin_delete_requests WHERE status = "pending"'
    : 'SELECT COUNT(*) AS total FROM admin_delete_requests WHERE status = "pending" AND requested_by = ' . (int)$user['id'];
$result = $conn->query($requestSql);
$summary['my_requests'] = (int)$result->fetch_assoc()['total'];

$registrations = [];
$result = $conn->query('SELECT DATE(created_at) AS date, COUNT(*) AS total FROM users WHERE role <> "super_admin" AND created_at >= CURRENT_DATE - INTERVAL 29 DAY GROUP BY DATE(created_at) ORDER BY date');
while ($row = $result->fetch_assoc()) $registrations[] = ['date' => $row['date'], 'count' => (int)$row['total']];

$actions = [];
$actionStmt = $conn->prepare('SELECT action_code AS label, COUNT(*) AS total FROM audit_logs WHERE actor_user_id = ? AND created_at >= CURRENT_DATE - INTERVAL 29 DAY GROUP BY action_code ORDER BY total DESC, action_code LIMIT 8');
$actionStmt->bind_param('i', $user['id']);
$actionStmt->execute();
$result = $actionStmt->get_result();
while ($row = $result->fetch_assoc()) $actions[] = ['label' => $row['label'], 'count' => (int)$row['total']];

$failedStmt = $conn->prepare('SELECT COUNT(*) AS total FROM audit_logs WHERE actor_user_id = ? AND success = 0 AND created_at >= CURRENT_DATE - INTERVAL 29 DAY');
$failedStmt->bind_param('i', $user['id']);
$failedStmt->execute();
$failedActions = (int)$failedStmt->get_result()->fetch_assoc()['total'];

echo json_encode([
    'status' => 'success',
    'summary' => $summary,
    'status_breakdown' => [
        ['label' => 'Approved', 'count' => $summary['approved']],
        ['label' => 'Pending', 'count' => $summary['pending']],
        ['label' => 'Blocked', 'count' => $summary['blocked']]
    ],
    'registrations' => $registrations,
    'actions' => $actions,
    'action_required' => ['pending_users' => $summary['pending'], 'pending_deletions' => $summary['my_requests'], 'failed_actions' => $failedActions]
]);