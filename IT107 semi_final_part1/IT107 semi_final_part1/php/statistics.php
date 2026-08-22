<?php
include 'admin_auth.php';
require_permission('accounts.view');

$summary = [
    'total' => 0,
    'approved' => 0,
    'pending' => 0,
    'blocked' => 0,
    'admins' => 0,
    'super_admins' => 0,
    'users' => 0
];
$result = $conn->query('SELECT COUNT(*) AS total, SUM(account_status = "approved") AS approved, SUM(account_status = "pending") AS pending, SUM(account_status = "blocked") AS blocked, SUM(role = "admin") AS admins, SUM(role = "super_admin") AS super_admins, SUM(role = "user") AS users FROM users');
$row = $result->fetch_assoc();
foreach ($summary as $key => $value) $summary[$key] = (int)($row[$key] ?? 0);

$status = [];
$result = $conn->query('SELECT account_status AS label, COUNT(*) AS total FROM users GROUP BY account_status ORDER BY FIELD(account_status, "approved", "pending", "blocked")');
while ($row = $result->fetch_assoc()) $status[] = ['label' => ucfirst($row['label']), 'count' => (int)$row['total']];

$roles = [];
$result = $conn->query('SELECT role AS label, COUNT(*) AS total FROM users GROUP BY role ORDER BY FIELD(role, "user", "admin", "super_admin")');
while ($row = $result->fetch_assoc()) $roles[] = ['label' => ucwords(str_replace('_', ' ', $row['label'])), 'count' => (int)$row['total']];

$deletionRequests = [];
$result = $conn->query('SELECT status AS label, COUNT(*) AS total FROM admin_delete_requests GROUP BY status ORDER BY FIELD(status, "pending", "approved", "rejected")');
while ($row = $result->fetch_assoc()) $deletionRequests[] = ['label' => ucfirst($row['label']), 'count' => (int)$row['total']];

$registrations = [];
$result = $conn->query('SELECT DATE(created_at) AS date, COUNT(*) AS total FROM users WHERE created_at >= CURRENT_DATE - INTERVAL 29 DAY GROUP BY DATE(created_at) ORDER BY date');
while ($row = $result->fetch_assoc()) $registrations[] = ['date' => $row['date'], 'count' => (int)$row['total']];

$pendingDeletions = 0;
$result = $conn->query('SELECT COUNT(*) AS total FROM admin_delete_requests WHERE status = "pending"');
$pendingDeletions = (int)$result->fetch_assoc()['total'];

$failedActions = 0;
$result = $conn->query('SELECT COUNT(*) AS total FROM audit_logs WHERE success = 0 AND created_at >= CURRENT_DATE - INTERVAL 29 DAY');
$failedActions = (int)$result->fetch_assoc()['total'];

echo json_encode([
    'status' => 'success',
    'summary' => $summary,
    'status_breakdown' => $status,
    'role_breakdown' => $roles,
    'deletion_requests' => $deletionRequests,
    'registrations' => $registrations,
    'action_required' => [
        'pending_users' => $summary['pending'],
        'pending_deletions' => $pendingDeletions,
        'failed_actions' => $failedActions
    ]
]);